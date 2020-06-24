import React, { Component } from 'react';
import AgoraRTC from "agora-rtc-sdk";
import * as firebase from "firebase/app";
import "firebase/database";
import './videoBroadCasting.css';

const APP_ID = "7c5860eca1cf4e14907d773462f3bada";
const TOKEN = "0067c5860eca1cf4e14907d773462f3badaIADhfGLor0szAzCc64VUa+q6izecD79hVvnWRbRgt8BtPPGGbHoAAAAAEADoGr0ICne5XgEAAQAJd7le";

class VideoBroadCasting extends Component {
    state = {
        remoteStreams: {},
        liveSteaming: [],
        currentScreenShare: null,
        uid: 0,
        localStream: {},
        screenStream: {},
        layout: false,
        videoMuteStatus: false,
        banner: null
    }

    componentDidMount() {
        this.initFirebase();
        this.client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
        this.initClient();
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
        this.database = firebase.database()
    }

    initClient = () => {
        this.client.init(
            APP_ID,
            function () {
                console.log("AgoraRTC client initialized");
            },
            function (err) {
                console.log("AgoraRTC client init failed", err);
            }
        );
        this.subscribeToClient();
    };


    subscribeToClient = () => {
        this.client.on("stream-added", this.onStreamAdded);

        this.client.on("stream-removed", this.onStreamRemoved);

    };

    onStreamAdded = evt => {
        let stream = evt.stream;
        let streamId = stream.getId()
        console.log("New stream added: --------------------" + streamId);
        if (streamId != `screen_${this.state.uid}`) {
            this.setState({ remoteStreams: { ...this.state.remoteStreams, [streamId]: stream } }, () => {
                this.playLiveStream(streamId)
                console.log(this.state.remoteStreams)
            })
            this.client.subscribe(stream, function (err) {
                console.log("Subscribe stream failed", err);
            });
        }
    };

    onStreamRemoved = evt => {
        let stream = evt.stream;
        let streamId = stream.getId()
        if (streamId == `screen_${this.state.uid}`) {
            this.screenClient.leave()
        }
        delete this.state.remoteStreams[streamId];
        this.setState({ remoteStreams: this.state.remoteStreams })
        console.log("Remote stream is removed " + stream.getId());
    };

    playLiveStream = (streamId) => {
        if (this.state.liveSteaming.includes(streamId)) {
            this.state.remoteStreams[streamId].play(`agora_live_${streamId}`)
        }
    }

    streamFromLiveToRemote = (streamId) => {
        let index = this.state.liveSteaming.indexOf(streamId)
        if (index != -1) { this.state.liveSteaming.splice(index, 1) }
        this.state.remoteStreams[streamId].stop()
        this.setState({ liveStreamTime: this.state.liveSteaming })
    }

    streamFromRemoteToLive = (streamId) => {
        this.state.remoteStreams[streamId].play(`agora_live_${streamId}`)
    }

    registerFirebaseDatabaseEvent = () => {
        this.database.ref('livestream').on('child_added', (data) => {
            let streamId = data.val()
            if (streamId == `video_${this.state.uid}`) {
                this.state.localStream.stop()
            }
            this.setState({ liveSteaming: [...this.state.liveSteaming, streamId] }, () => {
                this.state.remoteStreams[streamId].play(`agora_live_${streamId}`)
            })
        })

        this.database.ref('livestream').on('child_removed', (data) => {
            let streamId = data.val()
            if (streamId == `video_${this.state.uid}`) {
                this.state.localStream.stop()
                this.state.localStream.play('agora_local')
            }
            let index = this.state.liveSteaming.indexOf(streamId);
            if (index != -1) { this.state.liveSteaming.splice(index, 1) }
            this.setState({ liveSteaming: this.state.liveSteaming })
        })

        this.database.ref('currentScreenShare').on('value', (data) => {
            console.log(this.state.remoteStreams)
            let streamId = data.val()
            console.log(this.state.uid, streamId)
            if (streamId != null && streamId != `screen_${this.state.uid}`) {
                this.state.liveSteaming.map((streamId) => { this.streamFromLiveToRemote(streamId) })
                this.setState({ currentScreenShare: this.state.remoteStreams[streamId] }, () => {
                    this.streamFromRemoteToLive(streamId)
                })
            } else {
                this.setState({ currentScreenShare: null })
            }
        })

        this.database.ref('layout').on('value', (data) => {
            let layout = data.val()
            if (layout != null) {
                this.setState({ layout: layout })
            }
        })

        this.database.ref('banner').on('value', (data) => {
            let banners = data.val()
            this.setState({ banner: banners != null ? banners[banners.length - 1] : null })
        })
    }

    initLocalStream = () => {
        let local = AgoraRTC.createStream({
            streamID: `video_${this.state.uid}`,
            audio: false,
            video: true,
            screen: false
        });
        this.setState({ localStream: local });
        this.setState({ remoteStreams: { ...this.state.remoteStreams, [local.getId()]: local } })
        let client = this.client;
        local.init(
            function () {
                console.log("getUserMedia successfully");
                local.setBeautyEffectOptions(true, {
                    lighteningContrastLevel: 1,
                    lighteningLevel: 1,
                    smoothnessLevel: 0.5,
                    rednessLevel: 0.1
                });
                local.play("agora_local");
                client.publish(local, function (err) {
                    console.log("Publish local stream error: " + err);
                });

                client.on("stream-published", function (evt) {
                    console.log("Publish local stream successfully");
                });
            },
            function (err) {
                console.log("getUserMedia failed", err);
            }
        );
    };

    checkforPublishStream = (condition) => {

        this.client.setClientRole("host");
        this.client.join(
            TOKEN,
            'one',
            `video_${this.state.uid}`,
            (uid) => {
                console.log("User " + uid + " join channel successfully");
                this.initLocalStream();
                this.registerFirebaseDatabaseEvent();
            },
            function (err) {
                console.log("Join channel failed", err);
            }
        );
    }

    joinChannel = (e) => {
        e.preventDefault();
        if (this.state.uid == 0) {
            let uid = Math.floor(Math.random() * (999 - 100 + 1) + 100);
            this.setState({ uid: uid }, () => {
                this.checkforPublishStream(true)
            })
        } else {
            this.checkforPublishStream(true)
        }
    };

    video = () => {
        if (this.state.videoMuteStatus) {
            document.getElementById('agora_local').style.display = 'block';
            document.getElementById('video_local').style.display = 'none';
            this.state.videoMuteStatus = false;
            this.state.localStream.unmuteVideo();
        } else {
            document.getElementById('agora_local').style.display = 'none';
            document.getElementById('video_local').style.display = 'block';
            this.state.videoMuteStatus = true;
            this.state.localStream.muteVideo();
        }
    }

    stop = () => {
        if (Object.keys(this.state.localStream).length != 0) {
            this.state.localStream.stop()
            this.client.leave()
        }
        if (Object.keys(this.state.screenStream).length != 0) {
            this.state.screenStream.stop()
            this.screenClient.leave()
        }
        this.setState({ liveSteaming: [], banner: {} })
        this.database.ref('livestream').off('child_added');
        this.database.ref('livestream').off('child_removed');
        this.database.ref('banner').off('value');
    }

    intializScreenStream = () => {
        let screenStream = AgoraRTC.createStream({
            streamID: `screen_${this.state.uid}`,
            audio: false,
            video: false,
            screen: true
        });
        this.setState({ screenStream: screenStream })
        let screenClient = this.screenClient;
        screenStream.init(
            function () {
                screenClient.publish(screenStream, function (err) {
                    console.log("Publish local stream error: " + err);
                });
                screenClient.on("stream-published", function (evt) {
                    console.log("Publish local stream successfully");
                });
            },
            function (err) {
                console.log("getUserMedia failed", err);
            }
        );
    }


    screenClientJoinChannel = () => {
        console.log("Calling Channel")
        if (this.state.uid == 0) {
            let uid = Math.floor(Math.random() * (999 - 100 + 1) + 100);
            this.setState({ uid: uid })
        }
        this.screenClient.setClientRole("host");

        this.screenClient.join(
            TOKEN,
            'one',
            `screen_${this.state.uid}`,
            (uid) => {
                console.log("User " + uid + " join channel successfully");
                this.intializScreenStream();
            },
            function (err) {
                console.log("Join channel failed", err);
            }
        );
    }

    screenShare = () => {
        this.screenClient = AgoraRTC.createClient({ mode: "live", codec: "h264" });
        this.screenClient.init(
            APP_ID,
            function () {
                console.log("AgoraRTC client initialized");
            },
            function (err) {
                console.log("AgoraRTC client init failed", err);
            }
        )
        this.screenClientJoinChannel()
    }

    render() {
        return (
            <div className="main-container">
                <div className="live-stream-display" id="live_stream">
                    {/* <div className="video-user-block" style={{ width: '990px', height: '540px', top: '-9px', left: '-9px', zIndex: 5 }}>
                        <div
                            className="video-item-block"
                            id={`agora_canvas`}
                        />
                    </div> */}
                    {this.state.currentScreenShare != null
                        ? this.state.layout
                            ? (<div className="live-stream-user" style={{ width: 860 + 'px', height: 410 + 'px', top: -9 + 'px', left: -9 + 'px' }}>
                                <div
                                    className="video-item-block"
                                    key={this.state.currentScreenShare.getId()}
                                    id={`agora_live_${this.state.currentScreenShare.getId()}`}
                                />
                            </div>)
                            : (<div className="live-stream-user" style={{ width: 990 + 'px', height: 540 + 'px', top: -9 + 'px', left: -9 + 'px' }}>
                                <div
                                    className="video-item-block"
                                    key={this.state.currentScreenShare.getId()}
                                    id={`agora_live_${this.state.currentScreenShare.getId()}`}
                                />
                            </div>)
                        : <div></div>
                    }
                    {
                        this.state.liveSteaming.map((key, index) => {
                            let streamId = key
                            let width = 1980 / 2
                            let height = 1080 / 2
                            let top = -9
                            let left = -9
                            let length = this.state.liveSteaming.length
                            if (this.state.currentScreenShare != null) {
                                width = 200
                                height = 130
                                top = 400
                                left = index * 200
                            } else {
                                if (length <= 3) {
                                    width = (width / length)
                                    left += width * index
                                } else {
                                    width = ((width / length) * 2)
                                    height = (height / 2)
                                    left += width * (index % (length / 2))
                                    top += index < (length / 2) ? 0 : height
                                }

                            }
                            return (
                                <div className="live-stream-user" style={{ width: width + 'px', height: height + 'px', top: top + 'px', left: left + 'px' }}>
                                    <div
                                        className="video-item-block"
                                        key={streamId}
                                        id={`agora_live_${streamId}`}
                                    />
                                </div>
                            );
                        })}
                    {this.state.banner != null
                        ? <div className="banner">
                            {this.state.banner.bannerText}
                        </div>
                        : <div></div>
                    }
                </div>
                <div className="join-session-block">
                    <button onClick={(e) => {
                        this.joinChannel(e)
                    }} >join Session</button>
                    <button style={{ backgroundColor: "red", marginTop: "3px" }}
                        onClick={this.stop}
                    >Quit Session</button>
                </div>
                <div className={"video-container-block-raw"}>
                    <div className="video-user-block">
                        <div
                            className="video-item-block"
                            id={`agora_local`}
                        />
                        <div
                            className="disable-video-screen"
                            id={`video_local`}
                        > Disable Video by Local User</div>
                        <div
                            className="disable-audio-screen"
                            id={`audio_local`}
                        > Disable Audio by Local User</div>
                    </div>
                </div>
                <div className="local-user-controlbar">
                    <button onClick={(e) => this.video()} >Video</button>
                    <button onClick={(e) => this.changeLayout()} >Change Layout</button>
                    <button onClick={(e) => this.audio()}>Audio</button>
                    <button onClick={(e) => this.screenShare()}>Screen Share</button>
                </div>
            </div >
        );
    }
}

export default VideoBroadCasting;



