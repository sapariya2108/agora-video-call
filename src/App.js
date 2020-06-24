import React from 'react';
import logo from './logo.svg';
import { Switch, Route, Redirect, BrowserRouter as Router } from 'react-router-dom'
import './App.css';
import VideoBroadCasting from './agora/videoBroadCasting';
import HostPage from './agora/host';
import Audiance from './agora/audiance'
function App() {
  return (
    <Router>
      <Switch>
        <Route path="/host" render={() => <HostPage />}></Route>
        <Route path="/speaker" render={() => <VideoBroadCasting />}></Route>
        <Route path="/audiance" render={() => <Audiance></Audiance>}></Route>
      </Switch>
    </Router>
  );
}

export default App;
