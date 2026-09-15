import { Injectable, signal } from '@angular/core';

/** One question, and the words the buttons carry. */
export interface Question {
  /** The heading, phrased as the question it is. */
  heading: string;

  /** What doing it will mean, when that is not obvious from the heading. */
  detail?: string;

  /** The word on the button that does it. Never "OK": see the note below. */
  confirm: string;

  /** Whether doing it destroys something, which colours the button. */
  destroys?: boolean;
}

/**
 * Asking before doing something that cannot be undone.
 *
 * ── Why this exists, rather than `window.confirm` ────────────────────────────
 *
 * This asked three questions with the browser's own dialog, and a native
 * confirm is the one piece of a web application the application does not
 * write. It arrives in the operating system's typeface on the operating
 * system's grey, in the browser's language and not the page's, pinned to the
 * top of the window with the address bar as its title. On a page that is
 * otherwise a dark, deliberate thing, it reads as something going wrong.
 *
 * It is also two buttons that both say nothing. "OK" and "Cancel" force a
 * reader to hold the question in their head and work out which way round it
 * is, and the one that destroys something is the one on the left, in the
 * position and colour of the safe choice. A button that says **Delete** is a
 * button nobody presses by accident.
 *
 * ── Shaped like what it replaces ─────────────────────────────────────────────
 *
 * `window.confirm` returns a boolean, and every call site here read
 * `if (!confirm(...)) return;`. This returns a promise of one, so those lines
 * became `if (!await asking.for(...)) return;` -- the same sentence, the same
 * shape, and no state machine threaded through three components.
 */
@Injectable({ providedIn: 'root' })
export class AskingService {
  /** What is being asked, or nothing, which is what the dialog watches. */
  readonly asked = signal<Question | null>(null);

  private answer: ((yes: boolean) => void) | null = null;

  /**
   * Put a question on the screen and wait for it.
   *
   * @param question What to ask.
   * @returns True when they said yes.
   */
  for(question: Question): Promise<boolean> {
    // A second question while one is on screen would leave the first waiting
    // for ever. Nothing here asks two at once, and saying so is cheaper than
    // finding out the day something does.
    this.close(false);

    this.asked.set(question);

    return new Promise<boolean>((said) => {
      this.answer = said;
    });
  }

  /**
   * Answer the question on screen, if there is one.
   *
   * @param yes What they said.
   */
  close(yes: boolean): void {
    const said = this.answer;

    this.answer = null;
    this.asked.set(null);

    said?.(yes);
  }
}
