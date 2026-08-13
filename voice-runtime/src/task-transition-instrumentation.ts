type TaskTransitionState = {
  lastExitMs?: number;
  lastTaskId?: string;
  lastTaskType?: string;
  nextTaskId?: string;
  nextTaskType?: string;
  onEnterStartedMs?: number;
  parentResumedMs?: number;
  parentTaskType?: string;
};

const transitions = new Map<string, TaskTransitionState>();

function logTransition(event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event,
      ts: Date.now(),
      ...payload,
    }),
  );
}

function stateForCall(callId: string): TaskTransitionState {
  let state = transitions.get(callId);
  if (!state) {
    state = {};
    transitions.set(callId, state);
  }
  return state;
}

export function markTaskStarted(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  logTransition("task_started", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
  });
}

export function markTaskCompleted(input: {
  callId: string;
  taskId: string;
  taskType: string;
  complete?: boolean;
  collectedCount?: number;
}): void {
  logTransition("task_completed", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    complete: input.complete,
    collectedCount: input.collectedCount,
  });
}

export function markParentResumed(input: {
  callId: string;
  taskId: string;
  taskType: string;
  parentTaskType: string;
  collectionComplete?: boolean;
}): void {
  const state = stateForCall(input.callId);
  state.parentResumedMs = Date.now();
  state.parentTaskType = input.parentTaskType;
  logTransition("parent_resumed", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    parentTaskType: input.parentTaskType,
    collectionComplete: input.collectionComplete,
  });
}

export function markFirstParentAudio(input: {
  callId: string;
  taskId: string;
  taskType: string;
  parentTaskType: string;
}): void {
  const state = stateForCall(input.callId);
  const now = Date.now();
  const msSinceParentResume =
    state.parentResumedMs != null ? now - state.parentResumedMs : undefined;
  logTransition("first_parent_audio", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    parentTaskType: input.parentTaskType,
    msSinceParentResume,
  });
}

export function markTaskExitStarted(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  logTransition("task_exit_started", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
  });
}

export function markTaskExitFinished(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  const state = stateForCall(input.callId);
  state.lastExitMs = Date.now();
  state.lastTaskId = input.taskId;
  state.lastTaskType = input.taskType;
  logTransition("task_exit_finished", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
  });
}

export function markNextTaskCreateStarted(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  const state = stateForCall(input.callId);
  state.nextTaskId = input.taskId;
  state.nextTaskType = input.taskType;
  logTransition("next_task_create_started", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
  });
}

export function markNextTaskCreateFinished(input: {
  callId: string;
  taskId: string;
  taskType: string;
  contextUpdateMs?: number;
  taskInitMs?: number;
}): void {
  logTransition("next_task_create_finished", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    contextUpdateMs: input.contextUpdateMs,
    taskInitMs: input.taskInitMs,
  });
}

export function markTaskOnEnterStarted(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  const state = stateForCall(input.callId);
  state.onEnterStartedMs = Date.now();
  logTransition("on_enter_started", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    oldTaskId: state.lastTaskId,
    oldTaskType: state.lastTaskType,
    msSinceLastExit:
      state.lastExitMs != null ? Date.now() - state.lastExitMs : undefined,
  });
}

export function markFirstReplyRequested(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  logTransition("first_reply_requested", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
  });
}

export function markFirstAudioStarted(input: {
  callId: string;
  taskId: string;
  taskType: string;
}): void {
  const state = stateForCall(input.callId);
  const now = Date.now();
  const taskTransitionLatencyMs =
    state.lastExitMs != null ? now - state.lastExitMs : undefined;
  const onEnterToFirstAudioMs =
    state.onEnterStartedMs != null ? now - state.onEnterStartedMs : undefined;

  logTransition("first_audio_started", {
    callId: input.callId,
    taskId: input.taskId,
    taskType: input.taskType,
    oldTaskId: state.lastTaskId,
    oldTaskType: state.lastTaskType,
    onEnterToFirstAudioMs,
  });

  if (taskTransitionLatencyMs != null) {
    logTransition("task_transition_latency", {
      callId: input.callId,
      oldTaskId: state.lastTaskId,
      oldTaskType: state.lastTaskType,
      newTaskId: input.taskId,
      newTaskType: input.taskType,
      taskTransitionLatencyMs,
      onEnterToFirstAudioMs,
    });
  }
}

export function clearTaskTransitionState(callId: string): void {
  transitions.delete(callId);
}
