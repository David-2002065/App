import {renderHook} from '@testing-library/react-native';

import useOnboardingFlowRouter from '@hooks/useOnboardingFlow';

import dismissOnboardingModalBeforeExit from '@libs/Navigation/helpers/OnboardingNavigationUtils';
import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import {markOnboardingCompletionStartedLocally} from '@libs/OnboardingLocalCompletion';

import {startOnboardingFlow} from '@userActions/Welcome/OnboardingFlow';

import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';

import type {NavigationState} from '@react-navigation/native';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/Navigation/TransitionTracker', () => ({
    runAfterTransitions: ({callback}: {callback: () => void}) => {
        callback();
        return {cancel: () => {}};
    },
}));
jest.mock('@libs/Navigation/helpers/OnboardingNavigationUtils', () => jest.fn());
jest.mock('@userActions/Welcome/OnboardingFlow', () => ({
    ...jest.requireActual<Record<string, unknown>>('@userActions/Welcome/OnboardingFlow'),
    startOnboardingFlow: jest.fn(),
}));
jest.mock('@hooks/useRootNavigationState', () => jest.fn(() => false));
jest.mock('@libs/OnboardingLocalCompletion', () => {
    let hasStarted = false;
    return {
        markOnboardingCompletionStartedLocally: () => {
            hasStarted = true;
        },
        hasOnboardingCompletionStartedLocally: () => hasStarted,
        resetForTest: () => {
            hasStarted = false;
        },
    };
});

const {resetForTest} = jest.requireMock<{resetForTest: () => void}>('@libs/OnboardingLocalCompletion');

function buildRootState(isJoinWorkspaceTask = false): NavigationState {
    return {
        key: 'root',
        index: 1,
        routeNames: [NAVIGATORS.TAB_NAVIGATOR, NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR],
        routes: [
            {key: 'tabs', name: NAVIGATORS.TAB_NAVIGATOR},
            {
                key: 'onboarding',
                name: NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR,
                state: {
                    key: 'onboarding-stack',
                    index: 0,
                    routeNames: [SCREENS.ONBOARDING.WORK_EMAIL],
                    routes: [{key: 'work-email', name: SCREENS.ONBOARDING.WORK_EMAIL, params: isJoinWorkspaceTask ? {isJoinWorkspaceTask: 'true'} : undefined}],
                    stale: false,
                    type: 'stack',
                },
            },
        ],
        stale: false,
        type: 'stack',
    };
}

describe('useOnboardingFlowRouter', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        resetForTest();
        jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
        jest.spyOn(Navigation, 'isNavigationReady').mockResolvedValue(undefined);
        jest.spyOn(navigationRef, 'getRootState').mockReturnValue(buildRootState());
        await Onyx.clear();
        await Onyx.multiSet({
            [ONYXKEYS.IS_LOADING_APP]: false,
            [ONYXKEYS.NVP_TRY_NEW_DOT]: {},
            [ONYXKEYS.NVP_DISMISSED_PRODUCT_TRAINING]: {},
            [ONYXKEYS.NVP_ONBOARDING]: {hasCompletedGuidedSetupFlow: false},
        });
        await waitForBatchedUpdatesWithAct();
    });

    it('closes an open onboarding flow when completion arrives from another device', async () => {
        // Given onboarding was opened from stale cached data that says it is not completed
        renderHook(() => useOnboardingFlowRouter());
        await waitForBatchedUpdatesWithAct();
        expect(startOnboardingFlow).toHaveBeenCalled();

        // When a fresh refresh brings the completion made on iOS
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});
        await waitForBatchedUpdatesWithAct();

        // Then the mounted onboarding navigator is dismissed, because nothing else leaves onboarding for a remote completion
        expect(dismissOnboardingModalBeforeExit).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss when this client completed onboarding itself', async () => {
        // Given onboarding is open in this tab
        renderHook(() => useOnboardingFlowRouter());
        await waitForBatchedUpdatesWithAct();

        // When this client builds the optimistic completion (navigateAfterOnboarding owns the exit and its destination)
        markOnboardingCompletionStartedLocally();
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});
        await waitForBatchedUpdatesWithAct();

        // Then the router stays out of the way so the modal isn't dismissed twice
        expect(dismissOnboardingModalBeforeExit).not.toHaveBeenCalled();
    });

    it('keeps the Concierge join-workspace task open for a completed user', async () => {
        // Given a completed user running the Concierge join-workspace task inside the onboarding navigator
        jest.spyOn(navigationRef, 'getRootState').mockReturnValue(buildRootState(true));
        await Onyx.merge(ONYXKEYS.NVP_ONBOARDING, {hasCompletedGuidedSetupFlow: true});

        // When the router evaluates the completed state
        renderHook(() => useOnboardingFlowRouter());
        await waitForBatchedUpdatesWithAct();

        // Then the task is not closed, since it legitimately runs after onboarding
        expect(dismissOnboardingModalBeforeExit).not.toHaveBeenCalled();
    });
});
