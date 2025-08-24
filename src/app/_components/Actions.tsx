"use client";

import { api } from "~/trpc/react";
import { ActionList } from './ActionList';
import { CreateActionModal } from './CreateActionModal';
import { KanbanBoard } from './KanbanBoard';
import { IconLayoutKanban, IconList } from "@tabler/icons-react";
import { Button, Title, Stack, Paper, Text, Group } from "@mantine/core";
import { useState, useEffect } from "react";
import { CreateOutcomeModal } from "~/app/_components/CreateOutcomeModal";
import { CreateGoalModal } from "~/app/_components/CreateGoalModal";
import { notifications } from "@mantine/notifications";

type OutcomeType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'life' | 'problem';

interface ActionsProps {
  viewName: string;
  defaultView?: 'list' | 'alignment' | 'kanban';
  projectId?: string;
  displayAlignment?: boolean;
}

export function Actions({ viewName, defaultView = 'list', projectId, displayAlignment = false }: ActionsProps) {
  const [isAlignmentMode, setIsAlignmentMode] = useState(defaultView === 'alignment');
  const [isKanbanMode, setIsKanbanMode] = useState(defaultView === 'kanban');
  const utils = api.useUtils();

  // Conditionally fetch actions based on projectId
  const actionsQuery = projectId
    ? api.action.getProjectActions.useQuery({ projectId })
    : api.action.getAll.useQuery(); // Consider using getToday for specific views if needed

  const actions = actionsQuery.data; // Extract data from the chosen query

  // Bulk update mutation for rescheduling
  const bulkUpdateMutation = api.action.update.useMutation({
    onMutate: async ({ id, dueDate }) => {
      const mutationStartTime = Date.now();
      console.log(`🔧 [MUTATION DEBUG] onMutate started for action ${id}:`, {
        actionId: id,
        newDueDate: dueDate?.toISOString() || null,
        timestamp: new Date().toISOString()
      });

      // Cancel any outgoing refetches
      await utils.action.getAll.cancel();
      console.log(`🔧 [MUTATION DEBUG] Cancelled outgoing refetches for action ${id}`);
      
      // Get current data
      const previousData = utils.action.getAll.getData();
      const currentAction = previousData?.find(action => action.id === id);
      
      console.log(`🔧 [MUTATION DEBUG] Current cache state for action ${id}:`, {
        actionFound: !!currentAction,
        currentDueDate: currentAction?.dueDate?.toISOString() || null,
        actionName: currentAction?.name,
        totalCacheSize: previousData?.length
      });
      
      // Optimistically update the cache
      if (previousData) {
        utils.action.getAll.setData(undefined, (old) => {
          if (!old) {
            console.log(`🔧 [MUTATION DEBUG] No old cache data for action ${id}, returning empty array`);
            return [];
          }
          
          const updated = old.map((action) =>
            action.id === id
              ? { ...action, dueDate: dueDate ?? null }
              : action
          );
          
          const updatedAction = updated.find(action => action.id === id);
          console.log(`🔧 [MUTATION DEBUG] Optimistic update applied for action ${id}:`, {
            found: !!updatedAction,
            oldDueDate: currentAction?.dueDate?.toISOString() || null,
            newDueDate: updatedAction?.dueDate?.toISOString() || null,
            mutationDuration: Date.now() - mutationStartTime + 'ms'
          });
          
          return updated;
        });
      } else {
        console.log(`🔧 [MUTATION DEBUG] No previous data found in cache for action ${id}`);
      }
      
      console.log(`🔧 [MUTATION DEBUG] onMutate completed for action ${id}, duration:`, Date.now() - mutationStartTime + 'ms');
      return { previousData, actionId: id, mutationStartTime };
    },
    onError: (err, variables, context) => {
      const errorTime = Date.now();
      const duration = context?.mutationStartTime ? errorTime - context.mutationStartTime : 0;
      
      console.error(`🔧 [MUTATION DEBUG] onError for action ${variables.id}:`, {
        error: err.message || 'Unknown error',
        actionId: variables.id,
        duration: duration + 'ms',
        hadPreviousData: !!context?.previousData
      });

      // Rollback on error
      if (context?.previousData) {
        utils.action.getAll.setData(undefined, context.previousData);
        console.log(`🔧 [MUTATION DEBUG] Rollback completed for action ${variables.id}`);
      }
      
      notifications.show({
        title: 'Update Failed',
        message: `Failed to update action ${variables.id}: ${err.message || 'Unknown error'}`,
        color: 'red',
      });
    },
    onSettled: (data, error, variables, context) => {
      const settledTime = Date.now();
      const duration = context?.mutationStartTime ? settledTime - context.mutationStartTime : 0;
      
      console.log(`🔧 [MUTATION DEBUG] onSettled for action ${variables.id}:`, {
        success: !error,
        error: error?.message || null,
        actionId: variables.id,
        totalDuration: duration + 'ms',
        data: data ? { id: data.id, dueDate: data.dueDate?.toISOString() } : null
      });

      // Always refetch after error or success
      console.log(`🔧 [MUTATION DEBUG] Starting invalidation for action ${variables.id}`);
      void utils.action.getAll.invalidate();
      void utils.action.getToday.invalidate();
    },
  });

  // Handle overdue bulk reschedule (non-project pages only)
  const handleOverdueBulkReschedule = async (date: Date | null, actionIds: string[]) => {
    const startTime = Date.now();
    console.log('🔧 [BULK DEBUG] handleOverdueBulkReschedule started:', {
      date: date?.toISOString(),
      actionIds,
      totalCount: actionIds.length,
      timestamp: new Date().toISOString()
    });

    if (actionIds.length === 0) {
      console.log('🔧 [BULK DEBUG] No actions to reschedule - exiting early');
      return;
    }
    
    const totalCount = actionIds.length;

    // Log current cache state before starting
    const currentCache = utils.action.getAll.getData();
    const currentActions = currentCache?.filter(action => actionIds.includes(action.id));
    console.log('🔧 [BULK DEBUG] Current cache state for selected actions:', {
      selectedActions: currentActions?.map(a => ({ 
        id: a.id, 
        name: a.name, 
        currentDueDate: a.dueDate?.toISOString() 
      })),
      totalCacheActions: currentCache?.length
    });
    
    // Show initial notification
    notifications.show({
      id: 'bulk-reschedule',
      title: 'Rescheduling...',
      message: `Updating ${totalCount} action${totalCount !== 1 ? 's' : ''}...`,
      loading: true,
      autoClose: false,
    });
    
    try {
      console.log('🔧 [BULK DEBUG] Starting SEQUENTIAL mutations to avoid database connection pool exhaustion...');
      const results: Array<{actionId: string, success: boolean, result?: any, error?: string}> = [];
      
      // Process mutations sequentially to avoid overwhelming database connection pool
      for (let i = 0; i < actionIds.length; i++) {
        const actionId = actionIds[i]!;
        const index = i + 1;
        
        console.log(`🔧 [BULK DEBUG] Processing mutation ${index}/${totalCount} for action ${actionId}`);
        
        try {
          const result = await bulkUpdateMutation.mutateAsync({
            id: actionId,
            dueDate: date ?? undefined
          });
          
          console.log(`🔧 [BULK DEBUG] Mutation ${index}/${totalCount} SUCCESS for action ${actionId}:`, result);
          results.push({ actionId, success: true, result });
          
          // Small delay between mutations to prevent overwhelming the database
          if (i < actionIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`🔧 [BULK DEBUG] Mutation ${index}/${totalCount} FAILED for action ${actionId}:`, errorMessage);
          results.push({ actionId, success: false, error: errorMessage });
          
          // Check if this is a connection reset error
          if (errorMessage.includes('Server has closed the connection') || 
              errorMessage.includes('Connection reset by peer')) {
            console.error('🔧 [BULK DEBUG] Database connection lost - stopping bulk operation');
            // Stop processing more actions as connection is lost
            break;
          }
          
          // Continue with next mutation for other types of errors
        }
      }
      
      console.log('🔧 [BULK DEBUG] All mutations completed:', {
        results,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: Date.now() - startTime + 'ms'
      });

      const failedResults = results.filter(r => !r.success);
      const successfulResults = results.filter(r => r.success);

      // Check if any failures were due to connection issues
      const connectionErrors = failedResults.filter(r => 
        r.error?.includes('Server has closed the connection') || 
        r.error?.includes('Connection reset by peer')
      );

      if (failedResults.length > 0) {
        console.error('🔧 [BULK DEBUG] Some mutations failed:', failedResults);
        
        if (connectionErrors.length > 0) {
          throw new Error(
            `Database connection was lost during bulk update. ` +
            `${successfulResults.length} of ${totalCount} actions were updated successfully. ` +
            `Please try again for the remaining ${failedResults.length} actions.`
          );
        } else {
          throw new Error(`${failedResults.length} out of ${totalCount} mutations failed`);
        }
      }
      
      // Log cache state after mutations
      const updatedCache = utils.action.getAll.getData();
      const updatedActions = updatedCache?.filter(action => actionIds.includes(action.id));
      console.log('🔧 [BULK DEBUG] Cache state after mutations:', {
        updatedActions: updatedActions?.map(a => ({ 
          id: a.id, 
          name: a.name, 
          newDueDate: a.dueDate?.toISOString() 
        })),
        expectedDueDate: date?.toISOString() || null
      });

      // Success notification
      const message = date 
        ? `Successfully rescheduled ${successfulResults.length} action${successfulResults.length !== 1 ? 's' : ''} to ${date.toDateString()}`
        : `Successfully removed due date from ${successfulResults.length} action${successfulResults.length !== 1 ? 's' : ''}`;
      
      notifications.update({
        id: 'bulk-reschedule',
        title: date ? 'Bulk Reschedule Complete' : 'Due Date Removed',
        message,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
      
      console.log('🔧 [BULK DEBUG] Starting cache invalidation...');
      // Force immediate UI update
      await Promise.all([
        utils.action.getAll.invalidate(),
        utils.action.getToday.invalidate(),
        projectId ? utils.action.getProjectActions.invalidate({ projectId }) : Promise.resolve()
      ]);
      console.log('🔧 [BULK DEBUG] Cache invalidation complete');
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('🔧 [BULK DEBUG] Bulk reschedule failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: duration + 'ms',
        actionIds
      });

      notifications.update({
        id: 'bulk-reschedule',
        title: 'Bulk Update Failed',
        message: `Failed to update actions. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    }

    console.log('🔧 [BULK DEBUG] handleOverdueBulkReschedule finished, total duration:', Date.now() - startTime + 'ms');
  };

  // Bulk delete mutation for overdue actions (non-project pages only)
  const bulkDeleteMutation = api.action.bulkDelete.useMutation({
    onSuccess: (data) => {
      notifications.show({
        title: 'Overdue Actions Deleted',
        message: `Successfully deleted ${data.count} overdue actions`,
        color: 'green',
      });
      void actionsQuery.refetch();
    },
    onError: (error) => {
      notifications.show({
        title: 'Delete Failed',
        message: error.message || 'Failed to delete overdue actions',
        color: 'red',
      });
    },
  });

  // Handle overdue bulk delete (non-project pages only)
  const handleOverdueBulkAction = (action: 'delete', actionIds: string[]) => {
    if (action === 'delete') {
      bulkDeleteMutation.mutate({
        actionIds,
      });
    }
  };






  
  // Use the appropriate query based on whether we have a projectId
  const outcomes = projectId 
    ? api.outcome.getProjectOutcomes.useQuery(
        { projectId },
        {
          refetchOnWindowFocus: true,
          staleTime: 0
        }
      )
    : api.outcome.getMyOutcomes.useQuery(undefined, {
        refetchOnWindowFocus: true,
        staleTime: 0
      });

  console.log("outcomes are ", outcomes.data);
  useEffect(() => {
    setIsAlignmentMode(defaultView === 'alignment');
    setIsKanbanMode(defaultView === 'kanban');
  }, [defaultView]);

  console.log("outcomes are ", outcomes.data);
  // Filter outcomes for today
  const todayOutcomes = outcomes.data?.filter((outcome: any) => {
    if (!outcome.dueDate) return false;
    const dueDate = new Date(outcome.dueDate);
    const today = new Date();
    return (
      dueDate.getDate() === today.getDate() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getFullYear() === today.getFullYear()
    );
  });

  // Filter outcomes for this week (excluding today)
  const weeklyOutcomes = outcomes.data?.filter((outcome: any) => {
    if (!outcome.dueDate) return false;
    const dueDate = new Date(outcome.dueDate);
    const today = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    
    return (
      dueDate > today &&
      dueDate <= endOfWeek &&
      !(dueDate.getDate() === today.getDate() &&
        dueDate.getMonth() === today.getMonth() &&
        dueDate.getFullYear() === today.getFullYear())
    );
  });

  // Add debugging for filtered outcomes
  useEffect(() => {
    console.log('📊 Today outcomes:', todayOutcomes);
    console.log('📊 Weekly outcomes:', weeklyOutcomes);
  }, [todayOutcomes, weeklyOutcomes]);




  return (
    <div className="w-full  mx-auto">
      {/* View Toggle Buttons */}
      {projectId && (
        <Group gap="xs" mb="md">
          {/* List/Kanban toggle - only show for projects */}
          <Button
            variant={!isKanbanMode ? "filled" : "subtle"}
            size="sm"
            onClick={() => setIsKanbanMode(false)}
          >
            <Group gap="xs">
              <IconList size={16} />
              List
            </Group>
          </Button>
          <Button
            variant={isKanbanMode ? "filled" : "subtle"}
            size="sm"
            onClick={() => setIsKanbanMode(true)}
          >
            <Group gap="xs">
              <IconLayoutKanban size={16} />
              Kanban
            </Group>
          </Button>
          
          {/* Alignment toggle */}
          {displayAlignment && (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setIsAlignmentMode(!isAlignmentMode)}
            >
              <Group gap="xs">
                {isAlignmentMode ? <IconList size={16} /> : <IconLayoutKanban size={16} />}
                {isAlignmentMode ? 'Task View' : 'Alignment View'}
              </Group>
            </Button>
          )}
        </Group>
      )}

      {isAlignmentMode && (
        <Paper shadow="sm" p="md" radius="md" className="mb-8 bg-surface-secondary border border-border-primary">
          <Stack gap="md">
          <Group>
            <Title order={2} className="text-2xl">
              Today&apos;s theme is ...
            </Title>
          </Group>
            <Title order={2} className="text-xl bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
              What will make today great?
            </Title>
            <Stack gap="xs">
              {todayOutcomes?.map((outcome: any) => (
                <CreateOutcomeModal
                  key={outcome.id}
                  outcome={{
                    id: outcome.id,
                    description: outcome.description,
                    dueDate: outcome.dueDate,
                    type: (outcome.type || 'daily') as OutcomeType,
                    projectId: outcome.projects[0]?.id
                  }}
                  projectId={projectId}
                  trigger={
                    <Paper p="sm" className="bg-surface-primary cursor-pointer hover:bg-surface-hover transition-colors">
                      <Text>{outcome.description}</Text>
                    </Paper>
                  }
                />
              ))}
              {(!todayOutcomes || todayOutcomes.length === 0) && (
                <Text c="dimmed" size="sm" style={{ fontStyle: 'italic' }}>
                  No outcomes set for today. Add some in your morning routine.
                </Text>
              )}
            </Stack>
          </Stack>
          
        </Paper>
      )}

      {isAlignmentMode && (
        <Paper shadow="sm" p="md" radius="md" className="mb-8 bg-surface-secondary border border-border-primary">
          <Stack gap="md">
            <Title order={2} className="text-xl bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              What would make this week great?
            </Title>
            <Stack gap="xs">
              {weeklyOutcomes?.map((outcome: any) => (
                <CreateOutcomeModal
                  key={outcome.id}
                  outcome={{
                    id: outcome.id,
                    description: outcome.description,
                    dueDate: outcome.dueDate,
                    type: (outcome.type || 'daily') as OutcomeType,
                    projectId: outcome.projects[0]?.id
                  }}
                  projectId={projectId}
                  trigger={
                    <Paper p="sm" className="bg-surface-primary cursor-pointer hover:bg-surface-hover transition-colors">
                      <Group justify="space-between">
                        <Text>{outcome.description}</Text>
                        <Text size="sm" c="dimmed">
                          {new Date(outcome.dueDate).toLocaleDateString(undefined, { weekday: 'short' })}
                        </Text>
                      </Group>
                    </Paper>
                  }
                />
              ))}
              {(!weeklyOutcomes || weeklyOutcomes.length === 0) && (
                <Text c="dimmed" size="sm" style={{ fontStyle: 'italic' }}>
                  No outcomes set for this week. Plan your week in your morning routine.
                </Text>
              )}
            </Stack>
          </Stack>
         
        </Paper>
      )}
      {isAlignmentMode && (
        <Paper shadow="sm" p="md" radius="md" className="mb-8 bg-surface-secondary border border-border-primary">
           <CreateGoalModal projectId={projectId}>
              <Button 
                variant="filled" 
                color="dark"
                leftSection="+"
              >
                Add Goal
              </Button>
            </CreateGoalModal>
            <br/>
            <CreateOutcomeModal projectId={projectId}>
            <Button 
              variant="filled" 
              color="dark"
              leftSection="+"
            >
              Add Outcome
            </Button>
          </CreateOutcomeModal>
        </Paper>
      )}
      
      {/* Conditional rendering of List or Kanban view */}
      {projectId && isKanbanMode ? (
        <KanbanBoard 
          projectId={projectId}
          actions={actions ?? []} 
        />
      ) : (
        <ActionList 
          viewName={viewName} 
          actions={actions ?? []} 
          enableBulkEditForOverdue={true} // Enable bulk edit for all pages
          onOverdueBulkAction={handleOverdueBulkAction}
          onOverdueBulkReschedule={handleOverdueBulkReschedule}
        />
      )}
      <div className="mt-6">
        <CreateActionModal viewName={viewName} projectId={projectId}/>
      </div>
    </div>
  );
} 