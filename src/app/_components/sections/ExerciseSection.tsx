'use client';

import { Paper, Title, TextInput, Stack, Group, Button } from "@mantine/core";
import { IconList } from "@tabler/icons-react";
import { memo } from 'react';

interface ExerciseSectionProps {
  exercise: string;
  setExercise: (value: string) => void;
  saveExercise: () => void;
  isSaving: boolean;
  isDisabled: boolean;
}

const SaveButton = memo(({ 
  onClick, 
  loading, 
  disabled
}: { 
  onClick: () => void; 
  loading: boolean; 
  disabled: boolean;
}) => (
  <Button 
    onClick={onClick} 
    loading={loading} 
    disabled={disabled}
  >
    Save Exercise
  </Button>
));

SaveButton.displayName = 'SaveButton';

export const ExerciseSection = memo(({
  exercise,
  setExercise,
  saveExercise,
  isSaving,
  isDisabled
}: ExerciseSectionProps) => {
  return (
    <Paper shadow="sm" p="md" radius="md" className="bg-surface-primary">
      <Stack gap="md">
        <Group>
          <IconList className="text-blue-500" size={24} />
          <Title order={2} className="text-2xl">
            Exercise
          </Title>
        </Group>
        <TextInput
          placeholder="What will you do to nourish your body today?"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          size="md"
          className="bg-surface-secondary"
          rightSectionWidth={42}
          rightSection="🏃‍♂️"
        />
        <SaveButton 
          onClick={saveExercise} 
          loading={isSaving}
          disabled={!exercise.trim() || isDisabled}
        />
      </Stack>
    </Paper>
  );
});

ExerciseSection.displayName = 'ExerciseSection'; 