import { Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { AskingService } from './asking.service';

/**
 * The question, drawn by this application rather than by the browser.
 *
 * ── A real dialog element, and not a div pretending ──────────────────────────
 *
 * `<dialog>` with `showModal()` gives, for free and correctly, the things a
 * hand-built overlay gets nearly right: Escape closes it, the page behind is
 * inert, focus is trapped and then handed back to where it was, and it is
 * announced as a dialog. A hundred lines here would do the same job worse and
 * would be wrong on the machine of whoever does not use a mouse.
 *
 * ── The movement ─────────────────────────────────────────────────────────────
 *
 * A short rise and a fade, a fifth of a second, answering a press. Nothing
 * else in this application moves on its own, and a question that appears
 * without warning is a question somebody dismisses before reading.
 *
 * `display` and `overlay` have to be named in the transition, or the dialog is
 * taken off the screen before the fade has anywhere to happen; `@starting-style`
 * is what gives it somewhere to come from. It is turned off entirely for
 * anybody who asked for less motion.
 */
@Component({
  selector: 'app-asking',
  standalone: true,
  template: `
    <dialog #box class="asking" (cancel)="dismiss($event)" (click)="outside($event)">
      @if (asking.asked(); as question) {
        <div class="asking-sheet">
          <h2>{{ question.heading }}</h2>

          @if (question.detail) {
            <p>{{ question.detail }}</p>
          }

          <div class="asking-buttons">
            <button type="button" class="asking-no" (click)="asking.close(false)">Keep it</button>

            <button
              type="button"
              class="asking-yes"
              [class.asking-destroys]="question.destroys"
              autofocus
              (click)="asking.close(true)">
              {{ question.confirm }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styleUrl: './asking.component.css',
})
export class AskingComponent {
  readonly asking = inject(AskingService);

  private readonly box = viewChild.required<ElementRef<HTMLDialogElement>>('box');

  constructor() {
    effect(() => {
      const question = this.asking.asked();
      const box = this.box().nativeElement;

      // showModal on an already-open dialog throws, and close on a shut one is
      // a no-op that still fires an event. Both guarded, because this runs
      // again whenever the signal is touched.
      if (question && !box.open) box.showModal();
      if (!question && box.open) box.close();
    });
  }

  /** Escape, which the browser routes here rather than closing behind our back. */
  dismiss(event: Event): void {
    event.preventDefault();
    this.asking.close(false);
  }

  /**
   * A press on the dark ground outside the sheet.
   *
   * The backdrop belongs to the dialog, so every press lands on the dialog
   * itself and only the ones outside its box count as outside.
   */
  outside(event: MouseEvent): void {
    if (event.target !== this.box().nativeElement) return;

    const box = this.box().nativeElement.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;

    if (!inside) this.asking.close(false);
  }
}
