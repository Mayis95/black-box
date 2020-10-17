import * as React from 'react';
import { RouteComponentProps } from 'react-router';
const { ipcRenderer } = window.require('electron');

interface State {
    text: string;
    filePath: string,
}

export default class FooView extends React.Component<RouteComponentProps, State> {
    fileRef: React.RefObject<HTMLInputElement>;

    constructor(props: RouteComponentProps) {
        super(props);
        this.state = {
            text: "Open a file to find matches",
            filePath: ""
        };
        this.fileRef = React.createRef<HTMLInputElement>();
    }

    onOpenFileClick = () => {
        if (this.fileRef.current) {
            this.fileRef.current.click();
        }
    }

    onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let paths = e.currentTarget.files;

        if (!paths || paths.length < 1) {
            this.setState({ text: "Could not load files..." });
            return;
        }

        this.setState({
            filePath: paths[0].path,
            text: ""
        });
    }

    onProceedClick = () => {
        ipcRenderer.send('proceed-analyse', { filePath: this.state.filePath });
    }

    public render() {
        return (
            <div>
                <h3>Upload and find matches</h3>
                <p>
                    {this.state.text}
                    {this.state.filePath}
                </p>
                <button onClick={this.onOpenFileClick}>Open file...</button>
                <input type="file" ref={this.fileRef} onChange={this.onFileInputChange} style={{ display: "none" }} />
                <button onClick={this.onProceedClick}>Proceed</button>
            </div>
        );
    }
}
