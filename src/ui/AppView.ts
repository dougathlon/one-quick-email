import type { EmailScenario, InboxMessage } from '../game/types';
import { DEFAULT_SEND_WORD_MINIMUM } from '../game/wordCount';

export interface ViewCallbacks {
  onStartWork: () => void;
  onToggleMute: () => void;
  onSend: () => void;
  onPlayAgain: () => void;
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
            <span>Macrohard Office</span>
            <span class="window-controls" aria-hidden="true"><i>_</i><i>□</i><i>×</i></span>
          </div>
          <div class="title-body">
            <div class="title-icon" aria-hidden="true">
              <span class="envelope-flap"></span>
            </div>
            <h1 id="game-title"><span>ONE</span> QUICK EMAIL</h1>
            <p class="title-copy">Send a 100-word email.</p>
            <button id="start-work" class="bevel-button primary-button" data-testid="start-work">Start Work</button>
          </div>
          <div class="window-status"><span>Connection: office.local</span></div>
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
                <span>To:</span><strong data-testid="player-mailbox">Office Administration &lt;admin@office.local&gt;</strong>
                <span>Subject:</span><strong data-testid="incoming-subject">${escapeHtml(scenario.subject)}</strong>
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
            <span class="toolbar-spacer"></span>
            <button id="play-again" class="bevel-button inbox-play-again" type="button" data-testid="play-again" hidden>Play Again?</button>
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
            </aside>
            <section class="message-list-pane">
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
    this.queryButton('#play-again').addEventListener('click', this.callbacks.onPlayAgain);
    this.bindMute();
  }

  insertNewMessage(message: InboxMessage): void {
    const list = this.root.querySelector('#message-list');
    if (!list) return;
    list.insertAdjacentHTML('afterbegin', this.messageRow(message, true));
    list.scrollTop = 0;
    const total = list.children.length;
    const count = this.root.querySelector('#inbox-count');
    if (count) count.textContent = `(${total})`;
    const footerTotal = this.root.querySelector('#inbox-total');
    if (footerTotal) footerTotal.textContent = String(total);
    const playAgain = this.root.querySelector<HTMLButtonElement>('#play-again');
    if (playAgain) playAgain.hidden = false;
  }

  updateMuteButton(muted: boolean): void {
    const button = this.root.querySelector<HTMLButtonElement>('#mute-toggle');
    if (!button) return;
    button.textContent = muted ? 'Sound: Off' : 'Sound: On';
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  private messageRow(message: InboxMessage, arrivingMessage: boolean): string {
    const content = `
      <span class="message-icon" aria-hidden="true">${message.unread ? '✉' : '▱'}</span>
      <span class="message-sender">${escapeHtml(message.sender)}</span>
      <span class="message-subject">${escapeHtml(message.subject)}</span>
      <time>${escapeHtml(message.time)}</time>`;
    const testAttributes = arrivingMessage
      ? 'data-new-message="true" data-testid="new-message-row"'
      : 'data-testid="background-message"';
    return `<div class="message-row background-message ${message.unread ? 'unread' : ''}" role="listitem" ${testAttributes}>${content}</div>`;
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
