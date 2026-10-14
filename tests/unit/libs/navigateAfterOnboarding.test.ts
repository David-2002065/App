import SidePanelActions from '@libs/actions/SidePanel';
import {setOnboardingRHPVariant} from '@libs/actions/Welcome';
import {navigateToSubmitWorkspaceAfterOnboardingWithMicrotaskQueue} from '@libs/navigateAfterOnboarding';
import Navigation from '@libs/Navigation/Navigation';

import ROUTES from '@src/ROUTES';

jest.mock('@libs/Navigation/Navigation', () => ({
    __esModule: true,
    default: {
        dismissModal: jest.fn((options?: {afterTransition?: () => void}) => options?.afterTransition?.()),
        navigate: jest.fn(),
        setNavigationActionToMicrotaskQueue: jest.fn((callback: () => void) => callback()),
    },
}));

jest.mock('@libs/actions/SidePanel', () => ({
    __esModule: true,
    default: {openSidePanel: jest.fn()},
}));

jest.mock('@libs/actions/Welcome', () => ({
    setOnboardingRHPVariant: jest.fn(),
}));

jest.mock('@libs/actions/Modal', () => ({
    setDisableDismissOnEscape: jest.fn(),
}));

const navigationMock = jest.mocked(Navigation);

describe('navigateToSubmitWorkspaceAfterOnboardingWithMicrotaskQueue', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('lands on HOME with the side panel closed after joining or creating a Submit workspace', () => {
        // Given an employer user who just created or joined a Submit workspace
        // When onboarding finishes
        navigateToSubmitWorkspaceAfterOnboardingWithMicrotaskQueue();

        // Then they land on Home like the other non-manage-team intents
        expect(navigationMock.dismissModal).toHaveBeenCalledTimes(1);
        expect(navigationMock.navigate).toHaveBeenCalledTimes(1);
        expect(navigationMock.navigate).toHaveBeenCalledWith(ROUTES.HOME);
        // And no side panel opens, and rhpAdminsRoom isn't written, so opening Concierge later still shows the Concierge DM
        expect(setOnboardingRHPVariant).not.toHaveBeenCalled();
        expect(SidePanelActions.openSidePanel).not.toHaveBeenCalled();
    });
});
