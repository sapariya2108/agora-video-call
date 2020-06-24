import React, { Component } from 'react';
import AgoraRTC from "agora-rtc-sdk";
import './videoBroadCasting.css';
import * as firebase from "firebase/app";
import "firebase/database";

const APP_ID = "";
const TOKEN = "";

class HostPage extends Component {
    state = {
        canvasStream: {},
        remoteStreams: {},
        liveSteaming: [],
        currentScreenShare: null,
        uid: 0,
        streamUrl: "",
        streamKey: "",
        currentBanner: null,
        banner: "",
        liveStreamTime: 0,
        layout: false,
        interval: null
    }

    componentDidMount() {
        this.initFirebase();
        this.client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
        this.initClient();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.state.interval = setInterval(this.addBanner, 1000)
            } else {
                if (this.state.interval != null) {
                    clearInterval(this.state.interval)
                    this.state.interval = null
                }
                window.requestAnimationFrame(this.addBanner)
            }
        })
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
        firebase.initializeApp(firebaseConfig);
        this.database = firebase.database();
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

        this.client.on("stream-subscribed", this.onRemoteClientAdded);

        this.client.on("mute-video", this.onRemoteClientDiableVideo);

        this.client.on("unmute-video", this.onRemoteClientenableVideo);

        this.client.on("stream-removed", this.onStreamRemoved);

        this.client.on("peer-leave", this.onPeerLeave);
    };

    onStreamAdded = evt => {
        let stream = evt.stream;
        let streamId = stream.getId();
        console.log("New stream added: --------------------" + streamId);
        this.setState({ remoteStreams: { ...this.state.remoteStreams, [streamId]: stream } })
        this.client.subscribe(stream, function (err) {
            console.log("Subscribe stream failed", err);
        });
    };

    onRemoteClientAdded = evt => {
        let stream = evt.stream;
        let streamId = stream.getId()
        console.log("Remoter Stream -----------------", this.state.remoteStreams[streamId]);
        if (this.state.liveSteaming.includes(streamId)) {
            evt.stream.play(
                "agora_live_" + streamId
            );
        } else {
            evt.stream.play(
                "agora_remote_" + streamId
            );
        }
    };

    onRemoteClientDiableVideo = evt => {
        let uid = evt.uid;
        console.log("Remoter Stream Disable Video-----------------", uid);
        if (this.state.liveSteaming.length != 0) {
            document.getElementById(`agora_live_${uid}`).style.display = 'none';
        } else {
            document.getElementById(`agora_remote_${uid}`).style.display = 'none';
            document.getElementById(`video_remote_${uid}`).style.display = 'block';
        }
    }

    onRemoteClientenableVideo = evt => {
        let uid = evt.uid;
        console.log("Remoter Stream enable Video-----------------", uid);
        if (this.state.liveSteaming.length != 0) {
            document.getElementById(`agora_live_${uid}`).style.display = 'block';
        } else {
            document.getElementById(`agora_remote_${uid}`).style.display = 'block';
            document.getElementById(`video_remote_${uid}`).style.display = 'none';
        }
    }

    onStreamRemoved = evt => {
        let stream = evt.stream;
        if (stream) {
            let streamId = stream.getId();
            stream.stop();
            if (this.state.liveSteaming.includes(streamId)) {
                this.database.ref('livestream' + '/' + streamId).remove()
                let index = this.state.liveSteaming.indexOf(streamId)
                if (index != -1) { this.state.liveSteaming.splice(index, 1) }
                this.setState({
                    liveSteaming: this.state.liveSteaming
                })
            }
            if (streamId.includes('screen') && this.state.currentScreenShare != null) {
                this.state.currentScreenShare = null
                this.database.ref('currentScreenShare').remove()
            }
            delete this.state.remoteStreams[streamId];
            this.setState({ remoteStreams: this.state.remoteStreams })
            console.log("Remote stream is removed " + stream.getId());
        }
    };

    onPeerLeave = evt => {
        let stream = evt.stream;
        if (stream) {
            let streamId = stream.getId();
            stream.stop();
            if (this.state.liveSteaming.includes(streamId)) {
                this.database.ref('livestream' + '/' + streamId).remove()
                let index = this.state.liveSteaming.indexOf(streamId)
                if (index != -1) { this.state.liveSteaming.splice(index, 1) }
                this.setState({
                    liveSteaming: this.state.liveSteaming,
                })
            }
            if (streamId.includes('screen') && this.state.currentScreenShare != null) {
                this.state.currentScreenShare = null
                this.database.ref('currentScreenShare').remove()
            }
            delete this.state.remoteStreams[streamId];
            this.setState({ remoteStreams: this.state.remoteStreams })
            console.log(evt.uid + " leaved from this channel");
        }
    };
    initLocalStream = () => {

        let canvas = document.querySelector('canvas');
        let canvasStream = canvas.captureStream()
        let videoSoruce = canvasStream.getVideoTracks()[0]
        let local = AgoraRTC.createStream({
            streamID: `canvas_${this.state.uid}`,
            audio: false,
            video: true,
            videoSource: videoSoruce
        });
        this.setState({ canvasStream: local });
        let client = this.client;
        local.init(
            function () {
                console.log("getUserMedia successfully");
                // local.play('agora_local');
                local.on("player-status-change", function (evt) {
                    if (evt.isErrorState && evt.status === "paused") {
                        console.error(`Stream is paused unexpectedly. Trying to resume...`);
                        local.resume().then(function () {
                            console.log(`Stream is resumed successfully`);
                        }).catch(function (e) {
                            console.error(`Failed to resume stream. Error ${e.name} Reason ${e.message}`);
                        });
                    }
                });
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

    joinChannel = (e) => {
        e.preventDefault();
        let uid = Math.floor(Math.random() * (999 - 100 + 1) + 100);
        this.setState({ uid: uid }, () => {
            this.client.setClientRole("host");
            this.client.join(
                TOKEN,
                'one',
                `canvas_${this.state.uid}`,
                (uid) => {
                    console.log("User " + uid + " join channel successfully");
                    this.initLocalStream();
                    this.database.ref('layout').set(this.state.layout);
                },
                function (err) {
                    console.log("Join channel failed", err);
                }
            );
        })
    };

    stop = () => {
        this.database.ref('livestream').remove();
        this.setState({ liveSteaming: [] })
        this.client.leave()
    }

    streamFromLiveToRemote = (streamId) => {
        this.database.ref('livestream' + '/' + streamId).remove()
        let index = this.state.liveSteaming.indexOf(streamId)
        if (index != -1) { this.state.liveSteaming.splice(index, 1) }
        this.state.remoteStreams[streamId].stop()
        this.state.remoteStreams[streamId].play(`agora_remote_${streamId}`)
        this.setState({ liveStreamTime: this.state.liveSteaming })
    }

    streamFromRemoteToLive = (streamId) => {
        this.state.remoteStreams[streamId].stop()
        this.state.remoteStreams[streamId].play(`agora_live_${streamId}`)
        this.setLiveTranscoding();
    }

    addIntoLiveStream = (streamId) => {

        if (streamId.includes('screen')) {
            this.state.liveSteaming.map((streamId) => { this.streamFromLiveToRemote(streamId) })
            this.database.ref('currentScreenShare').set(streamId);
            this.setState({ currentScreenShare: this.state.remoteStreams[streamId] }, () => {
                this.streamFromRemoteToLive(streamId)
            })
        } else {

            if (this.state.currentScreenShare != null && !this.state.layout) {
                this.database.ref('layout').set(true)
                this.state.layout = true;
            }
            if (!this.state.liveSteaming.includes(streamId)) {
                this.database.ref('livestream').child(streamId).set(streamId);
                this.setState({ liveSteaming: [...this.state.liveSteaming, streamId] }, () => {
                    this.streamFromRemoteToLive(streamId)
                })
            }
        }
    }

    removeFromLiveStream = (streamId) => {

        if (streamId.includes('screen')) {
            this.state.remoteStreams[streamId].stop()
            this.state.remoteStreams[streamId].play(`agora_remote_${streamId}`)
            this.database.ref('currentScreenShare').remove()
            this.setState({ currentScreenShare: null }, () => {
                this.setLiveTranscoding()
            })
        } else {
            this.streamFromLiveToRemote(streamId)
            if (this.state.currentScreenShare != null && this.state.liveSteaming.length == 0) {
                this.state.layout = false;
                this.database.ref('layout').set(false);
                this.setLiveTranscoding();
            }
        }
    }

    startLiveStream = () => {
        this.client.startLiveStreaming(`${this.state.streamUrl}/${this.state.streamKey}`, true)
        setInterval(() => {
            this.state.liveStreamTime = this.state.liveStreamTime + 1
        }, 1000)
    }

    endLiveStream = () => {
        this.state.liveSteaming.map(key => {
            this.streamFromLiveToRemote(key)
        })
        this.database.ref('banner').remove();
        this.setState({ liveStreaming: {}, banner: "" })
        this.client.stopLiveStreaming("rtmp://a.rtmp.youtube.com/live2/2khr-d8vh-jhau-ftzt")
    }

    setLiveTranscoding = () => {
        let transcodingUser = []
        let width = 1980
        let height = 1080
        let length = this.state.liveSteaming.length;
        let config = {
            uid: this.state.canvasStream.getId(),
            alpha: 1,
            width: width,
            height: height,
            zOrder: 1,
            x: 0,
            y: 0
        }
        if (this.state.banner != "") {
            let canvasConfig = Object.assign({}, config)
            canvasConfig.zOrder = 10
            canvasConfig.alpha = 1
            canvasConfig.width = 1980
            canvasConfig.height = 80
            canvasConfig.x = 0
            canvasConfig.y = 800
            transcodingUser.push(canvasConfig)
        }
        if (this.state.currentScreenShare != null) {
            let screenConfig = Object.assign({}, config)
            screenConfig.uid = this.state.currentScreenShare.getId()
            if (this.state.layout) {
                screenConfig.width = 1580
                screenConfig.height = 680
            }
            transcodingUser.push(screenConfig)
        }
        let userConfig = Object.assign({}, config)
        if (this.state.currentScreenShare != null && this.state.layout) {
            userConfig.zOrder = 5
            userConfig.y = 680;
            userConfig.width = 600;
            userConfig.height = 400;
        }
        console.log(userConfig)
        if (this.state.currentScreenShare == null) {
            userConfig.zOrder = 5
            if (length <= 3) {
                userConfig.width = width / length;
            } else {
                userConfig.width = (width / length) * 2
                userConfig.height = height / 2
            }
        }
        this.state.liveSteaming.forEach((key, index) => {
            let config = Object.assign({}, userConfig)
            let left = config.x;
            let top = config.y;
            if (length <= 3 || this.state.currentScreenShare != null) {
                left = userConfig.width * index
            } else {
                left = userConfig.width * (index % (length / 2))
                top = index < (length / 2) ? 0 : userConfig.height
            }
            config.uid = key
            config.x = left
            config.y = top
            transcodingUser.push(config)
        })
        console.log(transcodingUser);
        var LiveTranscoding = {
            width: 1920,
            height: 1080,
            videoBitrate: 1130,
            videoFramerate: 60,
            lowLatency: false,
            audioSampleRate: AgoraRTC.AUDIO_SAMPLE_RATE_48000,
            audioBitrate: 48,
            audioChannels: 1,
            videoGop: 30,
            videoCodecProfile: AgoraRTC.VIDEO_CODEC_PROFILE_HIGH,
            userCount: 2,
            transcodingUsers: transcodingUser
        };
        this.client.setLiveTranscoding(LiveTranscoding);
    }

    addBanner = () => {
        // if (this.state.banners.length != 0) {
        //     this.state.banners[this.state.banners.length - 1]['endTime'] = this.state.liveStreamTime
        // }
        // let banner = {
        //     bannerText: e.target[0].value,
        //     startTime: this.state.liveStreamTime,
        //     endTime: Number.MAX_VALUE
        // }
        // this.state.banners.push(banner);
        // this.setState({ currentBanner: banner })
        // this.database.ref('banner').set(this.state.banners);
        let canvas = document.querySelector('canvas');
        let ctx = canvas.getContext("2d");
        if (this.state.banner != "") {
            ctx.fillStyle = "red";
            ctx.fillRect(0, 0, 990, 40);
            ctx.fillStyle = "white";
            ctx.font = "35px Georgia";
            ctx.textAlign = "center";
            ctx.fillText(this.state.banner, 495, 30)
        } else {
            ctx.clearRect(0, 0, 990, 40);
        }
        if (Object.keys(this.state.canvasStream).length != 0) {
            this.setLiveTranscoding()
        }
    }

    changeLayout = () => {
        this.database.ref('layout').set(!this.state.layout)
        if (this.state.layout && this.state.liveSteaming.length != 0) {
            this.state.liveSteaming.map((streamId) => {
                this.streamFromLiveToRemote(streamId)
            })
        }
        this.setState({ layout: !this.state.layout }, () => {
            this.setLiveTranscoding()
        })
    }


    render() {
        return (
            <div className="main-container">
                <div className="live-stream-display" id="live_stream">
                    <canvas width="990px" height="40px" style={{ position: 'absolute', top: '475px', left: 0, zIndex: 5 }}></canvas>
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
                    {this.state.currentBanner != null
                        ? <div className="banner">
                            {this.state.currentBanner.bannerText}
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
                    <button onClick={(e) => this.changeLayout()}>Change Layout</button>
                </div>
                <input type="text" name="streamurl" placeholder="Enter Stream Url" style={{ width: "30%" }} value={this.state.streamUrl} onChange={(e) => this.setState({ streamUrl: e.target.value })}></input>
                <br></br>
                <input type="text" name="streamkey" placeholder="Enter Stream Key" style={{ width: "30%" }} value={this.state.streamKey} onChange={(e) => this.setState({ streamKey: e.target.value })}></input>
                <div className="local-user-controlbar">
                    <button onClick={(e) => this.startLiveStream(e)}>Go For LiveStream</button>
                    <button onClick={(e) => this.endLiveStream()}>End LiveSteam</button>
                </div>
                <input type="text" name="banner" placeholder="Enter Text For Banner" style={{ width: "30%" }} value={this.state.banner} onChange={(e) => this.setState({ banner: e.target.value })}></input>
                <button onClick={(e) => this.addBanner()}>Add Banner</button>
                <div className="video-user-block">
                    <div
                        className="video-item-block"
                        id={`agora_local`}
                    />
                </div>
                <div className={"video-container-block-raw"}>
                    {Object.keys(this.state.remoteStreams).map(key => {
                        let stream = this.state.remoteStreams[key];
                        let streamId = stream.getId();
                        console.log(stream)
                        return (
                            <div className="video-user-block" id={`video_block_${streamId}`}>
                                <div
                                    className="video-item-block"
                                    key={streamId}
                                    id={`agora_remote_${streamId}`}
                                />
                                <div
                                    className="disable-video-screen"
                                    id={`video_remote_${streamId}`}
                                > Disable Video by Remote User</div>
                                <div
                                    className="disable-audio-screen"
                                    id={`audio_remote_${streamId}`}
                                > Disable Audio by Remote User</div>
                                <div className="remote-stream-button">
                                    <button onClick={(e) => this.addIntoLiveStream(streamId)}>Add</button>
                                    <button onClick={(e) => this.removeFromLiveStream(streamId)}>Remove</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div >
        );
    }
}

export default HostPage;
