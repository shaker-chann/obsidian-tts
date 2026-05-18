const { Plugin, Setting, PluginSettingTab } = require('obsidian');

class SimpleTTSPlugin extends Plugin {
    async onload() {
        console.log('Simple TTS 插件加载中...');

        this.utterance = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.availableVoices = [];

        this.settings = await this.loadSettings();

        this.addSettingTab(new SimpleTTSSettingTab(this.app, this));

        this.addStatusBar();

        this.addCommands();

        this.loadVoices();

        console.log('Simple TTS 插件加载完成');
    }

    loadVoices() {
        const load = () => {
            const voices = window.speechSynthesis.getVoices();
            const chineseVoices = voices.filter(voice =>
                voice.lang.startsWith('zh')
            );

            const previousVoices = this.availableVoices;

            if (chineseVoices.length > 0) {
                this.availableVoices = chineseVoices;
                // console.log('可用的中文语音数量:', chineseVoices.length);
            } else if (voices.length > 0) {
                this.availableVoices = voices;
                // console.log('未找到中文语音，使用所有语音:', voices.length);
            }


        };

        load();

        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = load;
        } else {
            setTimeout(load, 100);
        }
    }

    async loadSettings() {
        return Object.assign({
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            voice: 'auto'
        }, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addStatusBar() {
        this.statusBarContainer = this.addStatusBarItem();
        this.statusBarContainer.addClass('simple-tts-status-bar');

        this.playPauseBtn = this.statusBarContainer.createEl('span', {
            cls: 'simple-tts-btn simple-tts-play-pause',
            text: '▶',
            title: '播放'
        });
        this.playPauseBtn.onClickEvent(() => {
            this.togglePlayPause();
        });

        this.stopBtn = this.statusBarContainer.createEl('span', {
            cls: 'simple-tts-btn simple-tts-stop',
            text: '⏹',
            title: '停止'
        });
        this.stopBtn.onClickEvent(() => {
            this.stop();
        });

        this.updateButtonStates();
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    addCommands() {
        this.addCommand({
            id: 'simple-tts-play',
            name: '播放/继续朗读',
            callback: () => this.play()
        });

        this.addCommand({
            id: 'simple-tts-pause',
            name: '暂停朗读',
            callback: () => this.pause()
        });

        this.addCommand({
            id: 'simple-tts-stop',
            name: '停止朗读',
            callback: () => this.stop()
        });
    }

    getActiveNoteText() {
        // 获取活动的leaf
        const activeLeaf = this.app.workspace.activeLeaf;
        // console.log('活动leaf:', activeLeaf);

        if (!activeLeaf) {
            console.error('没有活动的leaf');
            return '';
        }

        const view = activeLeaf.view;
        // console.log('视图类型:', view.getViewType ? view.getViewType() : '未知');

        // 尝试获取编辑器
        let editor = null;

        // 方式1: 直接检查view是否有editor属性
        if (view && view.editor) {
            editor = view.editor;
        }
        // 方式2: 尝试通过getViewType判断并获取
        else if (view && view.getViewType && view.getViewType() === 'markdown') {
            // 对于markdown视图，尝试获取编辑器
            editor = view.editor || (view.sourceMode && view.sourceMode.editor);
        }
        // 方式3: 尝试通过leaf获取
        else if (activeLeaf.getViewState) {
            const state = activeLeaf.getViewState();
            // console.log('视图状态:', state);
        }

        // console.log('编辑器:', editor);

        if (!editor) {
            console.error('无法获取编辑器');
            return '';
        }

        // 获取选中的文本或全部文本
        const selection = editor.getSelection();
        if (selection) {
            // console.log('选中的文本:', selection);
            return selection;
        }

        const content = editor.getValue();
        // console.log('文档内容长度:', content.length);
        return content;
    }

    play() {
        // console.log('play 方法被调用');

        if (!('speechSynthesis' in window)) {
            console.error('浏览器不支持 Web Speech API');
            return;
        }

        if (this.isPaused) {
            console.log('恢复暂停的播放');
            window.speechSynthesis.resume();
            this.isPlaying = true;
            this.isPaused = false;
            this.updateButtonStates();
            return;
        }

        if (this.isPlaying) {
            console.log('已经在播放中');
            return;
        }

        const text = this.getActiveNoteText();
        // console.log('要朗读的文本长度:', text.length);

        if (!text.trim()) {
            console.error('没有文本可以朗读');
            return;
        }

        this.startSpeech(text);
    }

    startSpeech(text) {
        // console.log('开始朗读');
        this.stop();

        this.utterance = new SpeechSynthesisUtterance(text);

        // 设置语音参数
        this.utterance.rate = this.settings.rate;
        this.utterance.pitch = this.settings.pitch;
        this.utterance.volume = this.settings.volume;

        // 设置中文语音
        const voices = this.availableVoices && this.availableVoices.length > 0
            ? this.availableVoices
            : window.speechSynthesis.getVoices();
        // console.log('可用的语音数量:', voices.length);

        if (this.settings.voice === 'auto') {
            // 自动选择中文语音
            const chineseVoice = voices.find(voice =>
                voice.lang.startsWith('zh-CN') || voice.lang.startsWith('zh')
            );
            if (chineseVoice) {
                this.utterance.voice = chineseVoice;
                // console.log('选择的语音:', chineseVoice.name);
            } else {
                // console.log('未找到中文语音，使用默认语音');
            }
        } else {
            const selectedVoice = voices.find(voice => voice.name === this.settings.voice);
            if (selectedVoice) {
                this.utterance.voice = selectedVoice;
                // console.log('选择的语音:', selectedVoice.name);
            }
        }

        this.utterance.onstart = () => {
            // console.log('朗读开始');
            this.isPlaying = true;
            this.isPaused = false;
            this.updateButtonStates();
        };

        this.utterance.onend = () => {
            // console.log('朗读结束');
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
        };

        this.utterance.onerror = (event) => {
            // cancel() 会触发 onerror 而非 onend，错误类型为 interrupted/canceled，属于正常行为
            if (event.error === 'interrupted' || event.error === 'canceled') {
                return;
            }
            console.error('语音合成错误:', event.error, event);
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
        };

        window.speechSynthesis.speak(this.utterance);
    }

    pause() {
        if (this.isPlaying && 'speechSynthesis' in window) {
            window.speechSynthesis.pause();
            this.isPlaying = false;
            this.isPaused = true;
            this.updateButtonStates();
        }
    }

    stop() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        this.utterance = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.updateButtonStates();
    }

    updateButtonStates() {
        if (this.isPlaying) {
            this.playPauseBtn.text = '⏸';
            this.playPauseBtn.title = '暂停';
            this.playPauseBtn.removeClass('simple-tts-btn-disabled');
            this.playPauseBtn.addClass('simple-tts-btn-active');
            this.stopBtn.removeClass('simple-tts-btn-disabled');
        } else if (this.isPaused) {
            this.playPauseBtn.text = '▶';
            this.playPauseBtn.title = '继续播放';
            this.playPauseBtn.removeClass('simple-tts-btn-disabled');
            this.playPauseBtn.removeClass('simple-tts-btn-active');
            this.stopBtn.removeClass('simple-tts-btn-disabled');
        } else {
            this.playPauseBtn.text = '▶';
            this.playPauseBtn.title = '播放';
            this.playPauseBtn.removeClass('simple-tts-btn-disabled');
            this.playPauseBtn.removeClass('simple-tts-btn-active');
            this.stopBtn.addClass('simple-tts-btn-disabled');
        }
    }

    onunload() {
        this.stop();
    }
}

class SimpleTTSSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Simple TTS 设置' });

        // 语速设置
        new Setting(containerEl)
            .setName('语速')
            .setDesc('设置朗读的速度')
            .addSlider(slider => slider
                .setLimits(0.5, 2, 0.1)
                .setValue(this.plugin.settings.rate)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.rate = value;
                    await this.plugin.saveSettings();
                }));

        // 音调设置
        new Setting(containerEl)
            .setName('音调')
            .setDesc('设置朗读的音调')
            .addSlider(slider => slider
                .setLimits(0.5, 2, 0.1)
                .setValue(this.plugin.settings.pitch)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.pitch = value;
                    await this.plugin.saveSettings();
                }));

        // 音量设置
        new Setting(containerEl)
            .setName('音量')
            .setDesc('设置朗读的音量')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.volume)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.volume = value;
                    await this.plugin.saveSettings();
                }));

        // 语音选择
        new Setting(containerEl)
            .setName('语音')
            .setDesc('选择要使用的语音')
            .addDropdown(dropdown => {
                dropdown.addOption('auto', '自动 (中文)');

                const voices = this.plugin.availableVoices || [];
                if (voices.length === 0) {
                    dropdown.addOption('loading', '加载中...');
                } else {
                    voices.forEach(voice => {
                        dropdown.addOption(voice.name, `${voice.name} (${voice.lang})`);
                    });
                }

                dropdown.setValue(this.plugin.settings.voice);
                dropdown.onChange(async (value) => {
                    if (value !== 'loading') {
                        this.plugin.settings.voice = value;
                        await this.plugin.saveSettings();
                    }
                });
            });
    }
}

module.exports = SimpleTTSPlugin;
