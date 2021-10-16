const ws281x = require('rpi-ws281x');
const jsonfile = require('jsonfile')
const configFile = '/config.json'

class Main {

    constructor() {
        var config = new Config();
        // Current pixel position
        this.offset = 0;

        this.config = {};

        // Number of leds in my strip
        this.config.leds = 50;

        // Use DMA 10 (default 10)
        this.config.dma = 10;

        // Set full brightness, a value from 0 to 255 (default 255)
        this.config.brightness = config.getBrightness();

        // Set the GPIO number to communicate with the Neopixel strip (default 18)
        this.config.gpio = 18;

        // The RGB sequence may vary on some strips. Valid values
        // are "rgb", "rbg", "grb", "gbr", "bgr", "brg".
        // Default is "rgb".
        // RGBW strips are not currently supported.
        this.config.stripType = 'grb';

        // Configure ws281x
        ws281x.configure(this.config);

        this.pixels = new Uint32Array(this.config.leds);

        this.ledGroups = config.getLedGroups();
/*
        this.ledGroups = [
          new ledGroup("days",[0,3,4,7,8,11,12,15,16,19,20,23,24,27,28,31,32,35,36,39,40,43,44,47,48],now, 1, 'seconds', {"on": "0x38761D", "before": "0x111188", "after":"0x118800"}), //on: hellrosa, before: dunkelblau, after:grüne
          new ledGroup("advent",[8,23,36],now.setSeconds(now.getSeconds() + 4), 7, 'seconds', {"on": "0xFDEE00", "before": "0x3d85c6", "after":"0xf44336"}), //on: gelb, before: blau, after: rot
          new ledGroup("hintergrund",[1,2,5,6,9,10,13,14,17,18,21,22,25,26,29,30,33,34,37,38,41,42,45,46,49],0,0, 'timeless', {"on": "0xfbf6e7"}) //on: warmweiß
        ];
        */

        this.ledGroups.forEach (ledGroup => {
          ledGroup.leds.forEach (led => {
            this.pixels[led] = ledGroup.getLedColor(led);
          });
        });

        ws281x.render(this.pixels);

    }

    loop() {
        var ledColor = undefined;
        this.ledGroups.forEach(ledGroup => {
            ledColor = ledGroup.getLedColor(this.offset);
            if (ledColor != undefined){
              this.pixels[this.offset] = ledColor;

              ledColor = undefined;
            }
        });

        // Move on to next
        this.offset = (this.offset + 1) % this.config.leds;

        // Render to strip
        ws281x.render(this.pixels);
    }

    run() {
        // Loop every n ms
        setInterval(this.loop.bind(this), 1);
    }

};

class ledGroup {
  constructor(name, ledArray, startTime, delta, validityType, colors){
    this.name = name;
    this.startTime = new Date(startTime);
    this.leds = ledArray;
    this.delta = delta;
    this.validityType = validityType;
    this.colorOn = colors.on;
    this.colorBefore = colors.before;
    this.colorAfter = colors.after;
    if (this.validityType == 'timeless'){
      this.state = 'on';
    } else {
      this.state = 'before';
    }
  }

  getState(index){
    if (this.state == 'after')
      return this.state;

    var nowDate = new Date();
    var validityTemp = new Date(this.startTime);
    switch(this.validityType) {
      case 'date':
        var now = nowDate.getDate();
        var validityDate = new Date(validityTemp.setDate(this.startTime.getDate() + index*this.delta));
        var validity = validityDate.getDate();
        break;
      case 'hours':
        var now = nowDate.getHours();
        validityDate = new Date(validityTemp.getHours(this.startTime.getHours() + index*this.delta));
        validity = validityDate.getHours();
        break;
      case 'minutes':
        var now = nowDate.getMinutes();
        validityDate = new Date(validityTemp.setMinutes(this.startTime.getMinutes() + index*this.delta));
        validity = validityDate.getMinutes();
        break;
      case 'seconds':
        var now = nowDate.getSeconds();
        validityDate = new Date(validityTemp.setSeconds(this.startTime.getSeconds() + index*this.delta));
        validity = validityDate.getSeconds();
        break;
    }

    if(now == validity){
      var state = 'on'
    } else if(nowDate < validityDate) {
      state = 'before';
    } else if(nowDate > validityDate){
      state = 'after';
    }
    return state;
  }

  getLedColor(led){
    var index = this.leds.findIndex(element => element == led);
    var result = undefined;
    if (index>=0){
      if (this.validityType != 'timeless'){
        var state = this.getState(index);
      }else{
        state = this.state;
      }

      switch(state){
        case 'on':
          result = this.colorOn;
          break;
        case 'before':
          result = this.colorBefore;
          break;
        case 'after':
          result = this.colorAfter;
          break;
      }
    }
    return result;
  }
}

class Config {
  constructor(){
    var args = process.argv.slice(2);
    if(args[0] != ''){
      this.configFile = args[0];
    }else{
      this.configFile = 'config.json';
    }
    console.log(args);
    console.log(this.configFile);
    this.config = jsonfile.readFileSync(this.configFile);
  }

  getBrightness(){
    return this.config.brightness;
  }

  getLedGroups(){
    var ledGroups = [];
    this.config.ledGroups.forEach(configEntry => {
      if (configEntry.timeUnit != "timeless"){
        if(configEntry.startTime == "now"){
          var startTime = new Date();
        }else{
          var startTime = new Date(configEntry.startTime);
        }
      }

      if(configEntry.offset == undefined){
        var offset = 0;
      } else {
        var offset = configEntry.offset;
      }

      switch(configEntry.timeUnit) {
        case 'date':
          startTime = new Date(startTime.setDate(startTime.getDate() + offset));
          break;
        case 'hours':
          startTime = new Date(startTime.getHours(startTime.getHours() + offset));
          break;
        case 'minutes':
          startTime = new Date(startTime.setMinutes(startTime.getMinutes() + offset));
          break;
        case 'seconds':
          startTime = new Date(startTime.setSeconds(startTime.getSeconds() + offset));
          break;
      }

      ledGroups.push(new ledGroup(
        configEntry.name,
        configEntry.leds,
        startTime,
        configEntry.delta,
        configEntry.timeUnit,
        configEntry.colors
      ));
    });
    return ledGroups;
  }
}

var main = new Main();
main.run();
