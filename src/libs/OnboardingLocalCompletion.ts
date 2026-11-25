// Set when this client builds the optimistic guided setup completion, so a completion that arrives from another device can be told apart
let hasStartedLocalCompletion = false;

function markOnboardingCompletionStartedLocally() {
    hasStartedLocalCompletion = true;
}

function hasOnboardingCompletionStartedLocally(): boolean {
    return hasStartedLocalCompletion;
}

export {markOnboardingCompletionStartedLocally, hasOnboardingCompletionStartedLocally};
