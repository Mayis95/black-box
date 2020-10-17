import React from "react";
import { RouteComponentProps } from "react-router-dom";
const { ipcRenderer } = window.require('electron');

interface State {
    progress: number,
    filePath: string,
    text: string
}

export default class LoadView extends React.Component<RouteComponentProps, State>{
    fileRef: React.RefObject<HTMLInputElement>;
    constructor(props: RouteComponentProps) {
        super(props);
        this.state = {
            progress: 0,
            filePath: "",
            text: ""
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
        this.setState({ filePath: paths[0].path });
    }

    onProceedClick = () => {
        ipcRenderer.send('proceed-load', { filePath: this.state.filePath });
    }

    onStopClick = () => {
        ipcRenderer.send('stop-process', {});
    }

    render() {
        return (
            <div>
                <p>Progress: {this.state.progress}%</p><br></br>
                <button onClick={this.onOpenFileClick}>Open file...</button>
                <input type="file" ref={this.fileRef} onChange={this.onFileInputChange} style={{ display: "none" }} />
                <button onClick={this.onProceedClick}>Proceed</button>
                <button onClick={this.onStopClick}>Stop</button>
            </div>
        )
    }
}