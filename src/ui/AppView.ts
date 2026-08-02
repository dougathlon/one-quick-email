import type { EmailScenario, InboxMessage } from '../game/types';
import { countWords, DEFAULT_SEND_WORD_MINIMUM } from '../game/wordCount';

export interface ViewCallbacks {
  onStartWork: () => void;
  onToggleMute: () => void;
  onSend: () => void;
  onOpenReply: () => void;
  onPlayAgain: () => void;
  onViewSent: () => void;
  onBackToReply: () => void;
}

export class AppView {
  private composeWordCount: HTMLElement | null = null;
  private composeRequirement: HTMLElement | null = null;
  private sendButton: HTMLButtonElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly phaserLayer: HTMLElement,
    private readonly callbacks: ViewCallbacks,
  ) {}

  renderTitle(muted: boolean): void {
    this.root.innerHTML = `
      <main class="title-screen" data-testid="title-screen">
        <div class="title-window" role="dialog" aria-labelledby="game-title">
          <div class="window-titlebar">
            <span>Office Mail Setup</span>
            <span class="window-controls" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span>
          </div>
          <div class="title-body">
            <div class="title-icon" aria-hidden="true">
              <span class="envelope-flap"></span>
            </div>
            <p class="eyebrow">INTERNAL CORRESPONDENCE SYSTEM</p>
            <h1 id="game-title"><span>ONE</span> QUICK EMAIL</h1>
            <p class="title-copy">There is just one item to clear before the day can begin.</p>
            <button id="start-work" class="bevel-button primary-button" data-testid="start-work">Start Work</button>
          </div>
          <div class="window-status"><span>Connection: office.local</span><span>1 task pending</span></div>
        </div>
        ${this.muteButton(muted)}
      </main>`;
    this.bindMute();
    this.queryButton('#start-work').addEventListener('click', this.callbacks.onStartWork);
  }

  renderCompose(
    scenario: EmailScenario,
    draft: string,
    wordCount: number,
    inboxCount: number,
    muted: boolean,
  ): HTMLTextAreaElement {
    this.root.innerHTML = `
      <main class="office-desktop compose-screen" data-testid="compose-screen">
        <section class="mail-window" aria-label="Reply window">
          ${this.mailTitlebar(`Reply: ${scenario.subject}`)}
          ${this.menuBar()}
          <div class="toolbar" aria-label="Message toolbar">
            <button class="tool-button" type="button" disabled aria-label="New message">✉</button>
            <button class="tool-button" type="button" disabled aria-label="Print">▣</button>
            <span class="toolbar-divider"></span>
            <button id="send-email" class="bevel-button send-button" type="button" data-testid="send-email" ${wordCount < DEFAULT_SEND_WORD_MINIMUM ? 'disabled' : ''}>Send</button>
            <span class="toolbar-spacer"></span>
            <span class="connection-label"><i></i> Connected</span>
          </div>
          <div class="mail-workspace">
            <aside class="folder-pane" aria-label="Folders">
              <div class="pane-caption">Mail Folders</div>
              <ul class="folder-tree">
                <li><span>▾</span> Personal Folders</li>
                <li class="folder active"><span>▣</span> Inbox <b id="compose-inbox-count">(${inboxCount})</b></li>
                <li class="folder"><span>▤</span> Drafts</li>
                <li class="folder"><span>➤</span> Sent Items</li>
                <li class="folder"><span>⌫</span> Deleted Items</li>
              </ul>
              <div class="folder-note">Mailbox size<br><strong>18.4 MB</strong> of 20 MB</div>
            </aside>
            <section class="compose-pane">
              <div class="address-grid">
                <span>From:</span><strong>${escapeHtml(scenario.senderName)} &lt;${escapeHtml(scenario.senderEmail)}&gt;</strong>
                <span>To:</span><strong>you@office.local</strong>
                <span>Subject:</span><strong>${escapeHtml(scenario.subject)}</strong>
              </div>
              <article class="incoming-message" data-testid="incoming-email">
                ${scenario.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
              </article>
              <div class="reply-divider"><span>YOUR REPLY</span><span>Plain Text</span></div>
              <textarea
                id="reply-editor"
                data-testid="reply-editor"
                aria-label="Email reply"
                aria-describedby="word-requirement"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                wrap="soft"
              >${escapeHtml(draft)}</textarea>
              <div class="compose-status" aria-live="polite">
                <span id="word-count" data-testid="word-count">${wordCount} ${wordCount === 1 ? 'word' : 'words'}</span>
                <strong id="word-requirement" class="${wordCount >= DEFAULT_SEND_WORD_MINIMUM ? 'ready' : ''}" data-testid="word-requirement">${wordCount >= DEFAULT_SEND_WORD_MINIMUM ? 'Ready to send' : `${DEFAULT_SEND_WORD_MINIMUM} words required`}</strong>
              </div>
            </section>
          </div>
          <div class="window-status"><span>Replying to one recipient</span><span>Security zone: Local intranet</span></div>
        </section>
      </main>
      ${this.muteButton(muted)}`;

    this.composeWordCount = this.root.querySelector('#word-count');
    this.composeRequirement = this.root.querySelector('#word-requirement');
    this.sendButton = this.queryButton('#send-email');
    this.sendButton.addEventListener('click', this.callbacks.onSend);
    this.bindMute();
    const editor = this.root.querySelector<HTMLTextAreaElement>('#reply-editor');
    if (!editor) throw new Error('Reply editor failed to render');
    return editor;
  }

  updateComposeStatus(wordCount: number): void {
    if (!this.composeWordCount || !this.composeRequirement || !this.sendButton) return;
    this.composeWordCount.textContent = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
    const ready = wordCount >= DEFAULT_SEND_WORD_MINIMUM;
    this.composeRequirement.textContent = ready ? 'Ready to send' : `${DEFAULT_SEND_WORD_MINIMUM} words required`;
    this.composeRequirement.classList.toggle('ready', ready);
    this.sendButton.disabled = !ready;
  }

  showMiniGame(active: boolean, label = ''): void {
    const shell = this.root.querySelector<HTMLElement>('.compose-screen');
    if (shell) {
      shell.inert = active;
      shell.setAttribute('aria-hidden', active ? 'true' : 'false');
    }
    this.phaserLayer.classList.toggle('active', active);
    this.phaserLayer.setAttribute('aria-hidden', active ? 'false' : 'true');
    this.phaserLayer.setAttribute('aria-label', active ? label : '');
    document.body.classList.toggle('mini-game-active', active);
  }

  renderInbox(messages: readonly InboxMessage[], muted: boolean): void {
    this.root.innerHTML = `
      <main class="office-desktop inbox-screen" data-testid="inbox-screen">
        <section class="mail-window">
          ${this.mailTitlebar('Inbox — Personal Folders')}
          ${this.menuBar()}
          <div class="toolbar inbox-toolbar">
            <button class="tool-button" disabled>✉</button><button class="tool-button" disabled>↶</button><button class="tool-button" disabled>↷</button>
            <span class="toolbar-divider"></span><span class="inbox-path">Personal Folders ▸ Inbox</span>
          </div>
          <div class="mail-workspace inbox-workspace">
            <aside class="folder-pane">
              <div class="pane-caption">Mail Folders</div>
              <ul class="folder-tree">
                <li><span>▾</span> Personal Folders</li>
                <li class="folder active"><span>▣</span> Inbox <b id="inbox-count">(${messages.length})</b></li>
                <li class="folder"><span>▤</span> Drafts</li>
                <li class="folder"><span>➤</span> Sent Items</li>
                <li class="folder"><span>⌫</span> Deleted Items</li>
              </ul>
              <div class="inbox-surprise-copy"><strong>Your email was sent.</strong><br>Take a moment. Any new message will appear at the top.</div>
            </aside>
            <section class="message-list-pane">
              <div class="mobile-inbox-note" data-testid="mobile-inbox-note" role="status" aria-live="polite">
                <strong>Your email was sent.</strong>
                <span>Take a moment. Any new message will appear at the top.</span>
              </div>
              <div class="message-list-header"><span></span><span>From</span><span>Subject</span><span>Received</span></div>
              <div id="message-list" class="message-list" role="list" data-testid="message-list">
                ${messages.map((message) => this.messageRow(message, false)).join('')}
              </div>
            </section>
          </div>
          <div class="window-status"><span><strong id="inbox-total">${messages.length}</strong> messages</span><span>Online</span></div>
        </section>
        ${this.muteButton(muted)}
      </main>`;
    this.bindMute();
  }

  insertRecipientReply(message: InboxMessage): void {
    const list = this.root.querySelector('#message-list');
    if (!list) return;
    list.insertAdjacentHTML('afterbegin', this.messageRow(message, true));
    list.scrollTop = 0;
    const replyButton = list.querySelector<HTMLButtonElement>('[data-recipient-reply="true"]');
    replyButton?.addEventListener('click', this.callbacks.onOpenReply);
    const total = list.children.length;
    const count = this.root.querySelector('#inbox-count');
    if (count) count.textContent = `(${total})`;
    const footerTotal = this.root.querySelector('#inbox-total');
    if (footerTotal) footerTotal.textContent = String(total);
    const mobileNote = this.root.querySelector('.mobile-inbox-note span');
    if (mobileNote) mobileNote.textContent = 'The reply has arrived. Open the highlighted message at the top.';
  }

  renderReply(scenario: EmailScenario, replyBody: string, muted: boolean): void {
    this.root.innerHTML = `
      <main class="office-desktop reply-screen" data-testid="reply-screen">
        <section class="message-window final-message-window">
          ${this.mailTitlebar(`Re: ${scenario.subject}`)}
          <div class="toolbar"><span class="tool-glyph" aria-hidden="true">↶</span><span class="tool-glyph" aria-hidden="true">↷</span><span class="toolbar-divider"></span><span>Reply received</span></div>
          <div class="reply-context" data-testid="reply-context">
            <strong>↩ Reply to the email you just sent</strong>
            <span>Your sent subject: Re: ${escapeHtml(scenario.subject)}</span>
          </div>
          <div class="address-grid final-address">
            <span>From:</span><strong>${escapeHtml(scenario.senderName)} &lt;${escapeHtml(scenario.senderEmail)}&gt;</strong>
            <span>To:</span><strong>you@office.local</strong>
            <span>Subject:</span><strong>Re: ${escapeHtml(scenario.subject)}</strong>
          </div>
          <article class="reply-body" data-testid="recipient-reply">
            <p>Hi,</p>
            ${replyBody.split('\n').filter(Boolean).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
            <p>Best,<br>${escapeHtml(scenario.senderName.split(' ')[0] ?? scenario.senderName)}</p>
          </article>
          <div class="final-actions">
            <button id="play-again" class="bevel-button primary-button" data-testid="play-again">Play Again</button>
            <button id="view-sent" class="bevel-button" data-testid="view-sent">View Sent Email</button>
          </div>
          <div class="window-status"><span>End of message</span><span>Online</span></div>
        </section>
        ${this.muteButton(muted)}
      </main>`;
    this.queryButton('#play-again').addEventListener('click', this.callbacks.onPlayAgain);
    this.queryButton('#view-sent').addEventListener('click', this.callbacks.onViewSent);
    this.bindMute();
  }

  renderSentEmail(scenario: EmailScenario, draft: string, muted: boolean): void {
    this.root.innerHTML = `
      <main class="office-desktop sent-screen" data-testid="sent-screen">
        <section class="message-window sent-message-window">
          ${this.mailTitlebar(`Sent: ${scenario.subject}`)}
          <div class="address-grid final-address">
            <span>From:</span><strong>you@office.local</strong>
            <span>To:</span><strong>${escapeHtml(scenario.senderName)} &lt;${escapeHtml(scenario.senderEmail)}&gt;</strong>
            <span>Subject:</span><strong>Re: ${escapeHtml(scenario.subject)}</strong>
          </div>
          <article class="sent-body" data-testid="sent-email-body">${escapeHtml(draft)}</article>
          <div class="final-actions">
            <button id="back-to-reply" class="bevel-button primary-button">Return to Reply</button>
          </div>
          <div class="window-status"><span>Sent Items</span><span>${countWords(draft)} words</span></div>
        </section>
        ${this.muteButton(muted)}
      </main>`;
    this.queryButton('#back-to-reply').addEventListener('click', this.callbacks.onBackToReply);
    this.bindMute();
  }

  updateMuteButton(muted: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>('#mute-toggle');
    if (!button) return;
    button.textContent = muted ? 'Sound: Off' : 'Sound: On';
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  private messageRow(message: InboxMessage, recipientReply: boolean): string {
    const subject = recipientReply
      ? `<span class="message-subject recipient-subject"><b class="reply-marker">REPLY TO YOUR SENT EMAIL</b><span>${escapeHtml(message.subject)}</span></span>`
      : `<span class="message-subject">${escapeHtml(message.subject)}</span>`;
    const content = `
      <span class="message-icon" aria-hidden="true">${message.unread ? '✉' : '▱'}</span>
      <span class="message-sender">${escapeHtml(message.sender)}</span>
      ${subject}
      <time>${escapeHtml(message.time)}</time>`;
    if (recipientReply) {
      return `<button type="button" class="message-row recipient-reply unread" role="listitem" data-recipient-reply="true" data-testid="recipient-reply-row">${content}</button>`;
    }
    return `<div class="message-row background-message ${message.unread ? 'unread' : ''}" role="listitem" data-testid="background-message">${content}</div>`;
  }

  private mailTitlebar(title: string): string {
    return `<div class="window-titlebar"><span class="mail-app-icon">✉</span><span>${escapeHtml(title)}</span><span class="window-controls" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span></div>`;
  }

  private menuBar(): string {
    return `<nav class="menu-bar" aria-label="Application menu"><span><u>F</u>ile</span><span><u>E</u>dit</span><span><u>V</u>iew</span><span><u>I</u>nsert</span><span>F<u>o</u>rmat</span><span><u>T</u>ools</span><span><u>H</u>elp</span></nav>`;
  }

  private muteButton(muted: boolean): string {
    return `<button id="mute-toggle" class="mute-button bevel-button" type="button" aria-pressed="${muted ? 'true' : 'false'}">${muted ? 'Sound: Off' : 'Sound: On'}</button>`;
  }

  private bindMute(): void {
    this.root.querySelector('#mute-toggle')?.addEventListener('click', this.callbacks.onToggleMute);
  }

  private queryButton(selector: string): HTMLButtonElement {
    const button = this.root.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Missing button: ${selector}`);
    return button;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => HTML_ENTITIES[character] ?? character);
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
};
