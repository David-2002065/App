let mockIsAppActive = true;
const mockPlay = jest.fn();
const mockRemove = jest.fn();
const mockSubscriptionRemove = jest.fn();
const mockCreateAudioPlayer = jest.fn(() => ({
    play: mockPlay,
    remove: mockRemove,
    addListener: jest.fn(() => ({remove: mockSubscriptionRemove})),
}));

jest.mock('expo-audio', () => ({
    createAudioPlayer: () => mockCreateAudioPlayer(),
    setAudioModeAsync: () => Promise.resolve(),
}));

// On native isVisible() is AppState.currentState === 'active'
jest.mock('@libs/Visibility', () => ({
    __esModule: true,
    default: {isVisible: () => mockIsAppActive, hasFocus: () => true, onVisibilityChange: () => () => {}},
}));

jest.mock('@libs/Log', () => ({hmmm: jest.fn(), alert: jest.fn(), info: jest.fn(), warn: jest.fn()}));

// eslint-disable-next-line import/first
import playSound, {SOUNDS} from '@libs/Sound/index.native';

const flush = () => new Promise((resolve) => setTimeout(resolve, 350));

describe('Sound (native)', () => {
    let unhandled: unknown[];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);

    beforeEach(() => {
        jest.clearAllMocks();
        unhandled = [];
        process.on('unhandledRejection', onUnhandled);
        mockIsAppActive = true;
    });

    afterEach(() => {
        process.off('unhandledRejection', onUnhandled);
    });

    it('does not leak a rejection or the player when iOS refuses the audio session', async () => {
        // Given iOS refuses to activate the session, like during a phone call
        mockPlay.mockImplementationOnce(() => {
            throw new Error('UnexpectedException: Session activation failed');
        });

        // When a sound is played
        await playSound(SOUNDS.RECEIVE);
        await flush();

        // Then the failure is handled and the native player is released
        expect(unhandled).toHaveLength(0);
        expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('does not create a player when the app left the foreground before the sound runs', async () => {
        // Given the app went to the background after the caller queued the sound
        mockIsAppActive = false;

        // When the queued sound runs
        await playSound(SOUNDS.ATTENTION);
        await flush();

        // Then no player is created, so iOS is never asked to activate the session
        expect(mockCreateAudioPlayer).not.toHaveBeenCalled();
    });

    it('still plays the sound in the foreground', async () => {
        // Given the app is active and the session is available
        // When a sound is played
        await playSound(SOUNDS.DONE);
        await flush();

        // Then the player is created and played, and kept until it finishes
        expect(mockPlay).toHaveBeenCalledTimes(1);
        expect(mockRemove).not.toHaveBeenCalled();
    });
});
