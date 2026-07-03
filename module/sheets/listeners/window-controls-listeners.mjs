export class WindowControlsListeners {

  /**
   * Enable dragging the window by clicking and holding the window-controls-custom div.
   * @param {ActorSheet} sheet - The sheet instance
   */
  static enableWindowDrag(sheet) {
    const controlsDiv = sheet.element.querySelector('.window-controls-custom');
    if (!controlsDiv) return;

    if (controlsDiv._dragHandler) {
      controlsDiv.removeEventListener('mousedown', controlsDiv._dragHandler);
    }

    const dragHandler = (event) => {
      const target = event.target;
      const isButton = target.matches('button, .control-btn, i') ||
                       target.closest('button, .control-btn');

      if (isButton) return;
      if (event.button !== 0) return;

      event.preventDefault();

      controlsDiv.classList.add('dragging');

      const window = sheet.element;
      const shiftX = event.clientX - window.offsetLeft;
      const shiftY = event.clientY - window.offsetTop;

      const onMouseMove = (moveEvent) => {
        const newLeft = moveEvent.clientX - shiftX;
        const newTop = moveEvent.clientY - shiftY;

        window.style.left = `${newLeft}px`;
        window.style.top = `${newTop}px`;

        sheet.position.left = newLeft;
        sheet.position.top = newTop;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        controlsDiv.classList.remove('dragging');

        sheet.setPosition(sheet.position);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    controlsDiv._dragHandler = dragHandler;
    controlsDiv.addEventListener('mousedown', dragHandler);
  }

  /**
   * Setup custom window control buttons (toggle dropdown, close) and double-click to minimize.
   * @param {ActorSheet} sheet - The sheet instance
   */
  static setupCustomControls(sheet) {
    WindowControlsListeners.enableWindowDrag(sheet);

    const toggleControlsBtn = sheet.element.querySelector('.toggle-controls-btn');
    if (toggleControlsBtn) {
      toggleControlsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const dropdown = sheet.element.querySelector('.controls-dropdown');
        if (dropdown) {
          dropdown.classList.toggle('expanded');
        }
      });
    }

    const controlsDiv = sheet.element.querySelector('.window-controls-custom');
    if (controlsDiv) {
      controlsDiv.addEventListener('dblclick', (event) => {
        const target = event.target;
        const isButton = target.matches('button, .control-btn, i') ||
                         target.closest('button, .control-btn');

        if (isButton) return;

        sheet.minimize();
      });
    }

    const closeBtn = sheet.element.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        sheet.close();
      });
    }
  }

  /**
   * Setup drag and double-click functionality for the minimized window header.
   * @param {ActorSheet} sheet - The sheet instance
   */
  static setupMinimizedHeader(sheet) {
    const windowHeader = sheet.element.querySelector('.window-header');
    if (!windowHeader) return;

    windowHeader.addEventListener('mousedown', (event) => {
      if (!sheet.element.classList.contains('minimized')) return;
      if (event.target.closest('.header-control')) return;
      if (event.button !== 0) return;

      event.preventDefault();

      const window = sheet.element;
      const shiftX = event.clientX - window.offsetLeft;
      const shiftY = event.clientY - window.offsetTop;

      const onMouseMove = (moveEvent) => {
        const newLeft = moveEvent.clientX - shiftX;
        const newTop = moveEvent.clientY - shiftY;

        window.style.left = `${newLeft}px`;
        window.style.top = `${newTop}px`;

        sheet.position.left = newLeft;
        sheet.position.top = newTop;
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        sheet.setPosition(sheet.position);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    windowHeader.addEventListener('dblclick', (event) => {
      if (!sheet.element.classList.contains('minimized')) return;
      if (event.target.closest('.header-control')) return;

      sheet.maximize();
    });
  }

}
