// ==UserScript==
// @name         智慧中小学(全新) [SmartEdu-AutoPlayer]
// @namespace    https://basic.smartedu.cn/
// @version      2025-07-26
// @description  自动播放“智慧中小学”平台视频，自动切换、检测完成状态，避免手动操作。
// @author       sudorm
// @match        https://basic.smartedu.cn/teacherTraining/*
// @match        https://basic.smartedu.cn/training/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// ==/UserScript==

const studyList = [];
const isFinish = '_finish';
const studyTime = 'study_time';

const userIdMatch = /ND_UC_AUTH-([^&]+)&ncet-xedu&token/;

let trainId;
let userId;
let token;

const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
});

(async function () {
    'use strict';

    const open = window.XMLHttpRequest.prototype.open;
    const send = window.XMLHttpRequest.prototype.send;

    // 记录是否已拦截成功
    let intercepted = false;

    // 临时变量保存 URL
    const targetURL = '/teach/api_static/trains/2025sqpx.json';

    // 重写 open 方法，记录 URL
    window.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        this._url = url;
        return open.apply(this, arguments);
    };

    // 重写 send 方法，仅拦截一次目标请求
    window.XMLHttpRequest.prototype.send = function (body) {
        if (this._url.includes(targetURL) && !intercepted) {
            const xhr = this;
            const handler = function () {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    console.log('[SmartEdu-AutoPlayer] 拦截到XHR响应：', xhr._url);
                    try {
                        const json = JSON.parse(xhr.responseText);
                        const tmp = json.train?.id;
                        if (tmp) {
                            trainId = tmp;
                            intercepted = true; // ✅ 标记已拦截成功
                            console.log('[SmartEdu-AutoPlayer] trainId:', trainId);

                            // ✅ 恢复原始 open 和 send 方法
                            window.XMLHttpRequest.prototype.open = open;
                            window.XMLHttpRequest.prototype.send = send;
                        }
                    } catch (e) {
                        console.error('[SmartEdu-AutoPlayer] JSON解析失败：', e);
                    }

                    xhr.removeEventListener('readystatechange', handler);
                }
            };

            this.addEventListener('readystatechange', handler);
        }

        return send.apply(this, arguments);
    };

    if (window.location.href.includes('train')) {
        setTimeout(() => start(), 10000);
    } else {
        waitForElement('.fish-btn .fish-btn-primary', list => {
            $(list[0]).click();
        });

        setTimeout(() => {
            startVideo();
            setTimeout(() => {
                const list = getVideoTags();
                setTimeout(() => {
                    selectVideo(list);
                }, 10000);
            }, 12000);
        }, 15000);
    }

})();

function startVideo() {
    const btn = document.getElementsByClassName('CourseIndex-module_course-btn_4TCHV')[0];
    btn.dispatchEvent(clickEvent);
}

function getVideoTags() {
    function simulateClickIfRightArrow(header) {
        const arrow = header.querySelector('.fishicon-right');
        if (arrow) header.dispatchEvent(clickEvent);
    }

    async function findAndClickRightArrowRecursive(parent) {
        const headers = parent.querySelectorAll('.fish-collapse-header');
        for (let header of headers) {
            simulateClickIfRightArrow(header);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const collapseContent = header.nextElementSibling;
            if (collapseContent && collapseContent.classList.contains('fish-collapse')) {
                await findAndClickRightArrowRecursive(collapseContent);
            }
        }
    }

    const rootElement = document.querySelector('.fish-collapse');
    if (rootElement) findAndClickRightArrowRecursive(rootElement).then(() => {
    });

    return document.getElementsByClassName('resource-item resource-item-train');
}

function selectVideo(list) {
    console.log('[SmartEdu-AutoPlayer] 视频列表：', list);
    console.log('[SmartEdu-AutoPlayer] 开始处理视频列表，共计：', list.length);

    let totalTime = 0;
    const timeInHours = getLocalStorage(studyTime);
    const timeInSeconds = timeInHours * 2500;
    let currentIndex = 0;

    function processNextVideo() {
        if (currentIndex >= list.length) {
            console.log('[SmartEdu-AutoPlayer] ✅ 所有视频处理完成');
            return;
        }

        const item = list[currentIndex++];
        console.log(`[SmartEdu-AutoPlayer] 🎯 第 ${currentIndex} 个视频开始，点击资源项：`, item);

        setTimeout(() => {
            $(item).click();

            const tryPlay = setInterval(() => {
                const video = document.querySelector('video');
                if (!video) {
                    console.log('[SmartEdu-AutoPlayer] ⏳ video 元素未加载，继续等待...');
                    return;
                }

                clearInterval(tryPlay);
                console.log('[SmartEdu-AutoPlayer] ✅ video 元素已加载:', video);

                const isCompleted = item.querySelector('i.iconfont.icon_checkbox_fill[title="已学完"]');
                if (isCompleted) {
                    setTimeout(() => {
                        console.log('[SmartEdu-AutoPlayer] ✔️ 当前视频已学完，跳过播放, 当前视频时长（秒）：', video.duration);
                        totalTime += video.duration;
                        console.log('[SmartEdu-AutoPlayer] 📊 当前累计学习时长（秒）：', totalTime);

                        if (totalTime > timeInSeconds) {
                            console.log('[SmartEdu-AutoPlayer] 🛑 学习时长达到上限，关闭页面');
                            setLocalStorage(isFinish, true);
                            window.close();
                        }
                        processNextVideo();
                    }, 10000);

                    return;
                }

                console.log('[SmartEdu-AutoPlayer] ▶️ 视频未学完，开始播放...');
                video.muted = true;
                video.autoplay = true;
                video.controls = false;

                const videoRect = video.getBoundingClientRect();
                console.log('[SmartEdu-AutoPlayer] 📹 视频元素位置信息:', videoRect);
                const centerX = videoRect.left + videoRect.width / 2;
                const centerY = videoRect.top + videoRect.height / 2;
                console.log('[SmartEdu-AutoPlayer] 🎯 视频中心点坐标:', {x: centerX, y: centerY});

                playVideo(centerX, centerY);

                video.addEventListener('loadedmetadata', () => {
                    console.log('[SmartEdu-AutoPlayer] 📥 视频元数据已加载，准备播放...');
                    video.play().then(() => {
                        console.log('[SmartEdu-AutoPlayer] ✅ 视频自动播放成功');
                    }).catch(err => {
                        console.error('[SmartEdu-AutoPlayer] ❌ 视频播放失败：', err);
                    });
                });

                video.addEventListener('pause', () => {
                    console.warn('[SmartEdu-AutoPlayer] ⏸ 视频暂停，尝试恢复播放...');
                    setTimeout(() => {
                        document.getElementsByClassName('fish-btn-primary')[0].click()
                    }, 300);

                    if (!video.ended) {
                        video.play().catch(err => {
                            console.error('[SmartEdu-AutoPlayer] ❌ 恢复播放失败：', err);
                        });
                    }
                });

                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && video.paused) {
                        console.log('[SmartEdu-AutoPlayer] 🔄 页面重新可见，恢复播放...');
                        video.play().catch(err => {
                            console.error('[SmartEdu-AutoPlayer] ❌ 可见恢复播放失败：', err);
                        });
                    }
                });

                video.addEventListener('ended', () => {
                    console.log('[SmartEdu-AutoPlayer] 🏁 当前视频播放完成');
                    totalTime += video.duration || 0;
                    console.log('[SmartEdu-AutoPlayer] 📊 当前累计学习时长（秒）：', totalTime);

                    if (totalTime > timeInSeconds) {
                        console.log('[SmartEdu-AutoPlayer] 🛑 学习时长达到上限，关闭页面');
                        setLocalStorage(isFinish, true);
                        window.close();
                    } else {
                        processNextVideo();
                    }
                });


            }, 3000);
        }, 5000);
    }

    processNextVideo();
}

function playVideo(x, y) {
    $.ajax({
        url: 'http://localhost:8000/click',
        type: 'GET',
        data: {'x': x, 'y': y}
    });
}

async function start() {
    getUserInfo();
    setLocalStorage(`teacher-train-introduction-pop-${trainId}`, 'popWindown');

    const map = initTags();
    for (let i = 0; i < studyList.length; i++) {
        const name = isFinish;
        studyList[i].dispatchEvent(clickEvent);
        setLocalStorage(name, false);
        console.log('[SmartEdu-AutoPlayer] start ' + name);
        setLocalStorage(studyTime, map.get(studyList[i]));
        await checkCompletion(name);
    }
}

function checkCompletion(name) {
    return new Promise(resolve => {
        const timer = setInterval(() => {
            if (getLocalStorage(name) === 'true') {
                clearInterval(timer);
                console.log(`[SmartEdu-AutoPlayer] ${name} 完成 ✅`);
                removeLocalStorage(name);
                resolve();
            } else {
                console.log(`[SmartEdu-AutoPlayer] ${name} 未完成，继续等待...`);
            }
        }, 10000);
    });
}

function initTags() {
    const trainTimeMatch = /\/\s*认定\s*(\d+)\s*学时/;
    const trainTimeMatch2 = /认定\s*(\d+)\s*学时/;
    const learned = /已认定\s*(\d+\.\d+)/;
    const studyMaps = new WeakMap();

    const list = document.getElementsByClassName('index-module_course_fn8uS');
    const subjectTab = document.getElementsByClassName('fish-tabs fish-tabs-top index-module_tag_shGB8')[0];

    for (let i = 0; i < list.length; i++) {
        const element = list[i];
        if (!subjectTab.contains(element)) {
            const str = element.getElementsByClassName('index-module_processC_0VNia')[1].innerText;
            const learnedMatch = str.match(learned);
            const totalMatch = str.match(trainTimeMatch);
            if (learnedMatch[1] >= totalMatch[1]) {
                console.log('[SmartEdu-AutoPlayer] 已学完', element);
                continue;
            }
            const tmp = element.getElementsByClassName('index-module_content_wADaM')[0];
            studyList.push(tmp);
            studyMaps.set(tmp, totalMatch[1]);
            console.log('[SmartEdu-AutoPlayer] 学习时长', element, totalMatch[1]);
            continue;
        }

        const str = subjectTab.getElementsByClassName('index-module_phase_peroid_ywfm2')[0].innerText;
        const match = str.match(trainTimeMatch2);
        const learnedMatch = str.match(learned);
        if (learnedMatch[1] > match[1]) {
            console.log('[SmartEdu-AutoPlayer] 已学完', element);
            break;
        }
        const tmp = element.getElementsByClassName('index-module_content_wADaM')[0];
        studyMaps.set(tmp, match[1]);
        studyList.push(tmp);
        break;
    }

    return studyMaps;
}

function waitForElement(selector, callback) {
    if ($(selector).length) {
        callback($(selector));
        return;
    }

    const observer = new MutationObserver(() => {
        const element = $(selector);
        if (element.length) {
            observer.disconnect();
            callback(element);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function getUserInfo() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (userIdMatch.test(key)) {
            const value = JSON.parse(JSON.parse(localStorage.getItem(key)).value);
            userId = value.user_id;
            token = value.access_token;
            console.log('[SmartEdu-AutoPlayer] userId', userId);
            console.log('[SmartEdu-AutoPlayer] token', token);
        }
    }
}

function getLocalStorage(key) {
    return localStorage.getItem(key);
}

function setLocalStorage(key, value) {
    localStorage.setItem(key, value);
}

function removeLocalStorage(key) {
    localStorage.removeItem(key);
}
