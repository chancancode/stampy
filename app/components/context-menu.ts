import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { assert } from '@ember/debug';
import { action } from '@ember/object';

export interface ContextMenuAction {
  label: string;
  description?: string;
  icon: string;
  dangerous?: boolean;
  callback: () => void;
}

interface ContextMenuArgs {
  parent?: string;
  description: string;
  actions: ContextMenuAction[];
}

enum Justify {
  Left = 'left',
  Center = 'center',
  Right = 'right'
}

enum Align {
  Above = 'above',
  Below = 'below'
}

function scrollParentFor({ parentElement }: HTMLElement): HTMLElement {
  while (parentElement !== null && !isScrollable(parentElement)) {
    parentElement = parentElement.parentElement;
  }

  return parentElement || document.body;
}

function isScrollable(element: HTMLElement): boolean {
  let { overflowY } = getComputedStyle(element);
  return overflowY === 'auto' || overflowY === 'scroll';
}

let ID = 0;

export default class ContextMenuComponent extends Component<ContextMenuArgs> {
  id = `context-menu-${ID++}`;

  @tracked isOpen = false;
  @tracked parent: HTMLElement | null = null;
  @tracked scroll: HTMLElement | null = null;
  @tracked button: HTMLButtonElement | null = null;
  @tracked menu: HTMLUListElement | null = null;
  @tracked focusIndex: number = 0;

  ignoreNextClick = false;

  get actionItems(): ContextMenuAction[] {
    return this.args.actions;
  }

  get hasActions(): boolean {
    return !!(this.actionItems?.length);
  }

  get disabled(): boolean {
    return !this.hasActions;
  }

  @action open(event: Event): void {
    if (this.ignoreNextClick) {
      this.ignoreNextClick = false;
      return;
    }

    let button = (event.target as HTMLElement).closest('button') as HTMLButtonElement;

    this.isOpen = true;
    this.parent = button.closest(this.args.parent || 'body');
    this.scroll = scrollParentFor(this.parent!);
    this.button = button;
  }

  @action close(): void {
    this.isOpen = false;
    this.parent = null;
    this.scroll = null;
    this.button = null;
    this.menu = null;
    this.focusIndex = 0;
  }

  @action position(): void {
    let { parent, scroll, button, menu } = this;

    assert('parent missing', parent);
    assert('scroll missing', scroll);
    assert('button missing', button);
    assert('menu missing', menu);

    let parentRect = parent.getBoundingClientRect();
    let buttonRect = button.getBoundingClientRect();
    let scrollRect = scroll.getBoundingClientRect();
    let menuRect = menu.getBoundingClientRect();

    let spaceToTheLeft = buttonRect.left - parentRect.left;
    let spaceToTheRight = parentRect.right - buttonRect.right;

    let justify: Justify;

    if (Math.abs(spaceToTheLeft - spaceToTheRight) < 5) {
      justify = Justify.Center;
    } else if (spaceToTheLeft < spaceToTheRight) {
      justify = Justify.Left;
    } else {
      justify = Justify.Right;
    }

    switch (justify) {
      case Justify.Left:
        menu.style.left = Math.round(spaceToTheLeft) + 'px';
        menu.style.right = 'auto';
        break;

      case Justify.Center:
        menu.style.left = Math.round((parentRect.width - menuRect.width) / 2) + 'px';
        menu.style.right = 'auto';
        break;

      case Justify.Right:
        menu.style.left = 'auto';
        menu.style.right = Math.round(spaceToTheRight) + 'px';
        break;
    }

    let align: Align;

    if (buttonRect.bottom + menuRect.height <= scrollRect.bottom) {
      align = Align.Below;
    } else {
      align = Align.Above;
    }

    switch (align) {
      case Align.Above:
        menu.style.top = 'auto';
        menu.style.bottom = Math.round(parentRect.height - buttonRect.top + parentRect.top) + 'px';
        break;

      case Align.Below:
        menu.style.top = Math.round(parentRect.height - parentRect.bottom + buttonRect.bottom) + 'px';
        menu.style.bottom = 'auto';
        break;
    }
  }

  @action didOpen(element: HTMLUListElement): void {
    this.menu = element;
    this.position();
    this.moveFocus();
  }

  @action moveFocus(index = this.focusIndex): void {
    this.focusIndex = index;
    let element = this.menu?.querySelector(`li:nth-child(${index + 1})`);
    (element as HTMLElement | null)?.focus();
  }

  @action moveFocusUp(): void {
    this.moveFocus((this.focusIndex + 1) % this.actionItems.length);
  }

  @action moveFocusDown(): void {
    this.moveFocus((this.actionItems.length + this.focusIndex - 1) % this.actionItems.length);
  }

  @action onButtonKeyDown(event: KeyboardEvent): void {
    let shouldHandle = false;

    if (event.key === 'ArrowUp') {
      shouldHandle = true;
      this.focusIndex = this.actionItems.length - 1;
    } else if (event.key === 'ArrowDown') {
      shouldHandle = true;
      this.focusIndex = 0;
    }

    if (shouldHandle) {
      event.preventDefault();
      event.stopPropagation();
      this.open(event);
    }
  }

  @action onButtonMouseDown(): void {
    if (this.isOpen) {
      // mousedown -> blur -> mouseup -> click
      // We are about to close the menu; don't immediately reopen it on click!
      this.ignoreNextClick = true;
    }
  }

  @action onDocumentKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.button?.focus();
    } else if (event.key === 'Tab') {
      // Restore focus so the browser can move it to the next focusable element
      this.button?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveFocusUp();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveFocusDown();
    }
  }

  @action onDocumentFocusOut(event: FocusEvent): void {
    if (this.menu && !(
      event.relatedTarget && this.menu.contains(event.relatedTarget as HTMLElement)
    )) {
      this.close();
    }
  }
}
