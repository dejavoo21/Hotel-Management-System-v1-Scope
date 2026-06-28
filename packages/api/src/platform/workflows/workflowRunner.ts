import { eventBus, type PlatformEvent } from '../event-bus/eventBus.service.js';
import { logger } from '../../config/logger.js';
import { runWorkflow } from './workflowEngine.service.js';
import { getWorkflowDefinitions } from './workflowRegistry.js';

let started = false;

function hasAnyWorkflowForEvent(event: PlatformEvent) {
  return getWorkflowDefinitions().some(
    (workflow) => workflow.enabled && workflow.trigger.eventTypes.includes(event.metadata.eventType)
  );
}

export function startWorkflowRunner() {
  if (started) return;
  started = true;

  eventBus.subscribeAll(async (event) => {
    if (!hasAnyWorkflowForEvent(event)) return;

    const workflows = getWorkflowDefinitions().filter((workflow) =>
      workflow.trigger.eventTypes.includes(event.metadata.eventType)
    );

    for (const workflow of workflows) {
      const result = await runWorkflow(workflow, event);
      if (result.status === 'COMPLETED') {
        logger.info('Workflow completed', {
          workflowId: result.workflowId,
          eventId: result.eventId,
          actionsRun: result.actionsRun,
        });
      }
      if (result.status === 'FAILED') {
        logger.warn('Workflow failed', result);
      }
    }
  });

  logger.info('Workflow Runner subscribed to Event Bus', {
    workflows: getWorkflowDefinitions().length,
  });
}
