/* eslint-disable testing-library/no-unnecessary-act -- This test drives a react-dom root directly, so render and unmount must be wrapped in act. */
import type {Root} from 'react-dom/client';

import {act} from 'react';
import {createRoot} from 'react-dom/client';

describe('react-dom onSelect', () => {
    let container: HTMLDivElement;
    let root: Root;
    let input: HTMLInputElement;
    const onSelect = jest.fn();
    const onMouseUp = jest.fn();

    beforeEach(() => {
        onSelect.mockClear();
        onMouseUp.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        act(() => {
            root.render(
                <input
                    defaultValue="Paragraph two text"
                    onSelect={onSelect}
                    onMouseUp={onMouseUp}
                />,
            );
        });
        const element = container.querySelector('input');
        if (!element) {
            throw new Error('input was not rendered');
        }
        input = element;
        act(() => {
            input.focus();
        });
        onSelect.mockClear();
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    function dragSelect(start: number, end: number, releaseTarget: Element) {
        act(() => {
            input.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            input.setSelectionRange(start, end);
            releaseTarget.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
        });
    }

    it('fires onSelect when the drag is released outside the React root', () => {
        // Given a focused input whose drag starts inside the root
        // When the mouse is released over <html>, like a drag that ends below the page
        dragSelect(0, 9, document.documentElement);

        // Then onSelect still fires for the new selection, so selection caches (like the composer's copy range) stay in sync
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('keeps firing onSelect for keyboard selection after a release outside the root', () => {
        // Given a drag that was released outside the root
        dragSelect(0, 9, document.documentElement);
        onSelect.mockClear();

        // When the selection is changed with the keyboard afterwards
        act(() => {
            input.setSelectionRange(0, 5);
            input.dispatchEvent(new KeyboardEvent('keydown', {bubbles: true, key: 'ArrowLeft', shiftKey: true}));
        });

        // Then onSelect fires, so the mouseDown flag isn't left stuck
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('dispatches onSelect and onMouseUp once when the drag is released inside the root', () => {
        // Given a focused input
        // When the drag is released on the input itself
        dragSelect(0, 9, input);

        // Then the document listener doesn't dispatch the same mouseup a second time
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onMouseUp).toHaveBeenCalledTimes(1);
    });
});
