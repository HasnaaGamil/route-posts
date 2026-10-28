import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** What the form hands to its parent when the user sends */
export interface CommentDraft {
  content: string;
  image: File | null;
}

const MAX_IMAGE_MB = 5;

/**
 * Text box + optional image + buttons, used for new comments, replies and edits.
 * The parent does the API call and passes `busy` / `error` back in.
 */
@Component({
  selector: 'app-comment-form',
  standalone: true,
  host: { class: 'block' },
  templateUrl: './comment-form.component.html',
})
export class CommentFormComponent {
  placeholder = input('Write a comment…');
  /** Starting text (used when editing) */
  initial = input('');
  submitLabel = input('Send');
  busy = input(false);
  error = input('');
  /** Shows a Cancel button (replies and edits) */
  cancellable = input(false);
  /** Shows the "Photo" button (off when editing) */
  allowImage = input(true);
  /** Lets the user send with no text and no new image (editing a comment that already has an image) */
  allowEmpty = input(false);
  /** Focuses the text box when the form appears (replies and edits) */
  autoFocus = input(false);

  submitted = output<CommentDraft>();
  cancelled = output<void>();

  text = linkedSignal(() => this.initial());
  image = signal<File | null>(null);
  preview = signal<string | null>(null);
  fileError = signal('');

  private box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  canSend = computed(
    () => !this.busy() && (!!this.text().trim() || !!this.image() || this.allowEmpty()),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
    afterNextRender(() => {
      if (this.autoFocus()) this.box()?.nativeElement.focus();
    });
  }

  onInput(e: Event) {
    this.text.set((e.target as HTMLTextAreaElement).value);
  }

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the user pick the same file again later
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.fileError.set('Please choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      this.fileError.set(`Image must be ${MAX_IMAGE_MB} MB or smaller.`);
      return;
    }

    this.fileError.set('');
    this.revokePreview();
    this.image.set(file);
    this.preview.set(URL.createObjectURL(file));
  }

  removeImage() {
    this.revokePreview();
    this.image.set(null);
    this.preview.set(null);
    this.fileError.set('');
  }

  send() {
    if (!this.canSend()) return;
    this.submitted.emit({ content: this.text().trim(), image: this.image() });
  }

  /** Called by the parent after a successful send */
  clear() {
    this.text.set('');
    this.removeImage();
  }

  private revokePreview() {
    const p = this.preview();
    if (p) URL.revokeObjectURL(p);
  }
}