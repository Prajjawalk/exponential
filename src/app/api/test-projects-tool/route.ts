import { NextRequest } from 'next/server';
import jwt from "jsonwebtoken";

export async function GET(request: NextRequest) {
  console.log('🧪 [TEST] Direct getAllProjectsTool test endpoint called');

  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('❌ [TEST] No auth token provided');
      return Response.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 [TEST] Token received, length:', token.length);

    // Verify token
    const decoded = jwt.verify(token, process.env.AUTH_SECRET ?? '') as any;
    console.log('✅ [TEST] Token verified, userId:', decoded.userId || decoded.sub);

    // Create runtime context similar to Mastra
    const runtimeContext = new Map();
    runtimeContext.set('authToken', token);

    // Import and call the tool directly
    const { getAllProjectsTool } = await import('/Users/james/code/mastra/src/mastra/tools/index.ts');
    
    console.log('🔧 [TEST] Tool imported successfully');

    // Call the tool directly
    const result = await getAllProjectsTool.execute({
      input: {}, // No input needed
      context: {},
      runtimeContext
    });

    console.log('🎉 [TEST] Tool executed successfully:', {
      projectCount: result.total,
      firstProject: result.projects[0]?.name || 'No projects'
    });

    return Response.json({
      success: true,
      result,
      message: `Successfully retrieved ${result.total} projects via direct tool call`
    });

  } catch (error) {
    console.error('💥 [TEST] Direct tool test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Direct tool test failed'
    }, { status: 500 });
  }
}