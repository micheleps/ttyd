import { bind } from 'decko';
import { Component, h } from 'preact';
import { Xterm, XtermOptions } from './xterm';

import '@xterm/xterm/css/xterm.css';
import { Modal } from '../modal';

interface Props extends XtermOptions {
    id: string;
}

interface State {
    modal: boolean;
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

        await this.xterm.refreshToken();
        this.xterm.open(this.container);
        this.xterm.connect();
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
    handlePostMessage(event: MessageEvent) {
        // Parse the message - expecting format like "?arg=type&arg=token&arg=..."
        if (typeof event.data === 'string' && event.data.startsWith('?')) {
            const params = new URLSearchParams(event.data.substring(1));
            const args = params.getAll('arg');
            if (args.length > 0) {
                console.log('[ttyd] Received args via postMessage:', args);
                this.xterm.setArgsFromPostMessage(args);
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
