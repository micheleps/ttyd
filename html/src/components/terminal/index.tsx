import { bind } from 'decko';
import { Component, h } from 'preact';
import { Xterm, XtermOptions } from './xterm';

import '@xterm/xterm/css/xterm.css';
import { Modal } from '../modal';

interface Props extends XtermOptions {
    id: string;
    waitForPostMessage?: boolean;
}

interface State {
    modal: boolean;
    terminalInitialized: boolean;
}

export class Terminal extends Component<Props, State> {
    private container: HTMLElement;
    private xterm: Xterm;

    constructor(props: Props) {
        super();
        this.xterm = new Xterm(props, this.showModal);
    }

    async componentDidMount() {
        // Listen for postMessage from parent window
        window.addEventListener('message', this.handlePostMessage);

        if (!this.props.waitForPostMessage) {
            // Normal flow: initialize terminal immediately
            await this.initializeTerminal();
        } else {
            // When waiting for postMessage:
            // 1. Refresh token and open WebSocket connection first
            // 2. But DON'T open xterm UI yet
            // 3. Wait for postMessage to arrive with arguments
            // 4. Send arguments through WebSocket
            // 5. Then open xterm UI
            await this.xterm.refreshToken();
            this.xterm.connect();
        }
    }

    @bind
    async initializeTerminal() {
        if (this.state.terminalInitialized) return;

        await this.xterm.refreshToken();
        this.xterm.open(this.container);
        this.xterm.connect();
        this.setState({ terminalInitialized: true });
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handlePostMessage);
        this.xterm.dispose();
    }

    render({ id }: Props, { modal }: State) {
        return (
            <div id={id} ref={c => { this.container = c as HTMLElement; }}>
                <Modal show={modal}>
                    <label class="file-label">
                        <input onChange={this.sendFile} class="file-input" type="file" multiple />
                        <span class="file-cta">Choose files…</span>
                    </label>
                </Modal>
            </div>
        );
    }

    @bind
    async handlePostMessage(event: MessageEvent) {
        // Parse the message - expecting format like "?arg=type&arg=token&arg=..."
        if (typeof event.data === 'string' && event.data.startsWith('?')) {
            const params = new URLSearchParams(event.data.substring(1));
            const args = params.getAll('arg');
            if (args.length > 0) {
                console.log('[ttyd] Received args via postMessage:', args);

                if (this.props.waitForPostMessage && !this.state.terminalInitialized) {
                    // Send arguments through WebSocket first
                    console.log('[ttyd] Sending arguments through WebSocket');
                    this.xterm.sendArgsViaWebSocket(args);

                    // Then open the xterm UI
                    console.log('[ttyd] Opening xterm UI after sending arguments');
                    this.xterm.open(this.container);
                    this.setState({ terminalInitialized: true });
                } else {
                    // Normal postMessage handling (for already initialized terminals)
                    this.xterm.setArgsFromPostMessage(args);
                }
            }
        }
    }

    @bind
    showModal() {
        this.setState({ modal: true });
    }

    @bind
    sendFile(event: Event) {
        this.setState({ modal: false });
        const files = (event.target as HTMLInputElement).files;
        if (files) this.xterm.sendFile(files);
    }
}
