import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';

import type PopoverWithMeasuredContentProps from '@components/PopoverWithMeasuredContent/types';
import FilterPopupButton from '@components/Search/FilterDropdowns/FilterPopupButton';
import Text from '@components/Text';

import isTablet from '@libs/isTablet';

import type * as RNKeyboardController from 'react-native-keyboard-controller';

import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import {View} from 'react-native';

const KEYBOARD_HEIGHT = 300;
const SAFE_AREA_PADDING_BOTTOM = 24;

const mockPopoverProps = jest.fn<void, [PopoverWithMeasuredContentProps]>();
let mockIsSmallScreenWidth = true;
let mockKeyboardOffset = 0;

jest.mock('@components/PopoverWithMeasuredContent', () => (props: PopoverWithMeasuredContentProps) => {
    mockPopoverProps(props);
    return props.children;
});
jest.mock('@hooks/useResponsiveLayout', () => () => ({isSmallScreenWidth: mockIsSmallScreenWidth, isInLandscapeMode: false}));
jest.mock('@hooks/useSafeAreaPaddings', () => () => ({paddingBottom: SAFE_AREA_PADDING_BOTTOM, paddingTop: 0}));
jest.mock('@libs/isTablet', () => jest.fn(() => false));
jest.mock('@src/utils/keyboard', () => ({dismissKeyboardAndExecute: (callback: () => void) => callback()}));
jest.mock('react-native-keyboard-controller', () => ({
    ...jest.requireActual<typeof RNKeyboardController>('react-native-keyboard-controller/jest'),
    useReanimatedKeyboardAnimation: () => ({height: {get: () => mockKeyboardOffset, value: mockKeyboardOffset}, progress: {get: () => 0, value: 0}}),
}));

function renderAndOpenFilterPopup() {
    render(
        <NavigationContainer>
            <FilterPopupButton
                PopoverComponent={() => <Text>popup content</Text>}
                renderButton={({onPress, ref}) => (
                    <View ref={ref}>
                        <Text onPress={onPress}>open filter</Text>
                    </View>
                )}
            />
        </NavigationContainer>,
    );
    fireEvent.press(screen.getByText('open filter'));
}

function getLastPopoverProps() {
    return mockPopoverProps.mock.lastCall?.[0];
}

function getContentWrapper() {
    // The wrapper is the closest native view around the popup content
    let node = screen.getByText('popup content').parent;
    while (node && typeof node.type !== 'string') {
        node = node.parent;
    }
    return node;
}

describe('FilterPopupButton', () => {
    beforeEach(() => {
        mockPopoverProps.mockClear();
        mockIsSmallScreenWidth = true;
        mockKeyboardOffset = 0;
        jest.mocked(isTablet).mockReturnValue(false);
    });

    it('keeps the bottom sheet above the keyboard on a phone instead of relying on the modal', async () => {
        // Given a phone with the keyboard open, which reports a negative offset
        mockKeyboardOffset = -KEYBOARD_HEIGHT;

        // When the filter popup opens
        renderAndOpenFilterPopup();

        // Then the modal doesn't avoid the keyboard, because on Android it stops short of it,
        // and the sheet pads itself by the keyboard height so Apply stays above the keyboard
        await waitFor(() => expect(getLastPopoverProps()?.isVisible).toBe(true));
        expect(getLastPopoverProps()?.avoidKeyboard).toBe(false);
        expect(getContentWrapper()).toHaveStyle({paddingBottom: KEYBOARD_HEIGHT});
    });

    it('pads the bottom sheet for the safe area while the keyboard is closed', async () => {
        // Given a phone with the keyboard closed
        mockKeyboardOffset = 0;

        // When the filter popup opens
        renderAndOpenFilterPopup();

        // Then the sheet keeps clear of the home indicator, because the keyboard isn't there to cover it
        await waitFor(() => expect(getLastPopoverProps()?.isVisible).toBe(true));
        expect(getContentWrapper()).toHaveStyle({paddingBottom: SAFE_AREA_PADDING_BOTTOM});
    });

    it('keeps the modal keyboard avoidance on tablets', async () => {
        // Given a tablet, where the sheet layout this fix targets isn't used
        jest.mocked(isTablet).mockReturnValue(true);

        // When the filter popup opens
        renderAndOpenFilterPopup();

        // Then the modal still avoids the keyboard, so their behavior doesn't change
        await waitFor(() => expect(getLastPopoverProps()?.isVisible).toBe(true));
        expect(getLastPopoverProps()?.avoidKeyboard).toBe(true);
    });
});
