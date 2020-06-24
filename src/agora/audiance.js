import React, { Component } from 'react';
import Vimeo from '@vimeo/player'
import * as firebase from "firebase/app";
import "firebase/database";
class Audiance extends Component {

    state = {
        sessionId: "",
        currentBanner: null,
        banners: []
    }

    componentDidMount() {
        this.initFirebase();
    }
    initFirebase = () => {
        const firebaseConfig = {
            apiKey: "AIzaSyAUkd0Xonsa35Zyak-gLmFprdzaBTgqG1Y",
            authDomain: "testing-492b5.firebaseapp.com",
            databaseURL: "https://testing-492b5.firebaseio.com",
            projectId: "testing-492b5",
            storageBucket: "testing-492b5.appspot.com",
            messagingSenderId: "1009985259266",
            appId: "1:1009985259266:web:b088577d133c1fd65e641b",
            measurementId: "G-2NDR1YVH5V"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        this.database = firebase.database().ref('banner');

    }

    startSession = () => {
        this.database.on('value', (data) => {
            console.log(data.val())
            this.setState({ banners: data.val() })
        })
        this.setState({ sessionId: this.state.sessionId }, () => {
            let iframe = document.getElementById('video');
            let player = new Vimeo(iframe);
            player.on('timeupdate', (data) => {
                console.log(data)
                this.state.banners.map((banner) => {
                    if (data.seconds >= banner.startTime && data.seconds <= banner.endTime) {
                        console.log(banner)
                        this.setState({ currentBanner: banner })
                    }
                })
            })
        })
    }
    
    render() {
        return (
            <div className="main-container">
                {this.state.sessionId != ""
                    ? (
                        <div style={{ padding: '56.25% 0 0 0', position: 'relative', width: '60%' }}>
                            <iframe id="video" src={`https://player.vimeo.com/video/${this.state.sessionId}`} frameborder="0" allow="autoplay; fullscreen" allowfullscreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}></iframe>
                            {this.state.currentBanner != null
                                ? <div id="bannerBlock" className="banner">
                                    {this.state.currentBanner.bannerText}
                                </div>
                                : <div></div>
                            }
                        </div>
                    )
                    : (<div>
                        <input type="text" name="sessionId" placeholder="Enter Session Id" style={{ width: "30%" }} onChange={(e) => this.state.sessionId = e.target.value}></input>
                        <button onClick={(e) => this.startSession()}>Start Session</button></div>)}
            </div >
        );
    }
}

export default Audiance;
