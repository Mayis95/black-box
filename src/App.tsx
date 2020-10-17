import * as React from "react";
import { BrowserRouter, Route, Switch, Redirect } from "react-router-dom";
import FooView from "./views/FooView";
import { Layout } from "./views/Layout";
import "./styles/main.scss";
import LoadView from "./views/LoadView";

export default function App() {
    return (
        <BrowserRouter>
            <Layout>
                <Switch>
                    <Route exact path="/" component={FooView} />
                    <Route exact path="/loader" component={LoadView} />
                    <Redirect from="*" to="/" />
                </Switch>
            </Layout>
        </BrowserRouter>
    );
}
