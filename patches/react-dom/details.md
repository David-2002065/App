# `react-dom` patches

### [react-dom+19.2.3+001+fix-onselect-mouseup-outside-root.patch](react-dom+19.2.3+001+fix-onselect-mouseup-outside-root.patch)

- Reason:

    ```
    SelectEventPlugin drops every onSelect while its mouseDown flag is set, and only a mouseup, contextmenu or dragend
    that reaches the React root clears it. A drag that starts in the composer and is released below the page sends its
    mouseup to <html>, outside the root, so the flag stays set and onSelect stops firing until the next click. The
    composer copies from the range cached in onSelect, so Cmd+C copies an empty string. This patch also listens for
    mouseup and dragend on the document, next to selectionchange, so the release is seen wherever it lands.
    ```

- Upstream PR/issue: 🛑
- E/App issue: https://github.com/Expensify/App/issues/107116
- PR introducing patch: 🛑
