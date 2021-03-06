const ws281x = require('rpi-ws281x');
const jsonfile = require('jsonfile')
const configFile = 'config.json'

class Main {

    constructor() {
        var config = new Config();
        // Current pixel position
        this.pixel = 0;

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
            ledColor = ledGroup.getLedColor(this.pixel);
            if (ledColor != undefined){
              ledColor = ledGroup.getFlicker(ledColor);
              this.pixels[this.pixel] = ledColor;
              ledColor = undefined;
            }
        });

        // Move on to next
        this.pixel = (this.pixel + 1) % this.config.leds;

        // Render to strip
        if(this.pixel == 0)
          ws281x.render(this.pixels);
    }

    run() {
        // Loop every n ms
        setInterval(this.loop.bind(this), 1);
    }

};

class ledGroup {
  constructor(name, ledArray, startTime, delta, validityType, colors, random, flicker){
    this.name = name;
    this.startTime = new Date(startTime);
    this.leds = ledArray;
    this.delta = delta;
    this.validityType = validityType;
    this.colorOn = colors.on;
    this.colorBefore = colors.before;
    this.colorAfter = colors.after;
    if (random == undefined)
    {
      this.randomOn = undefined;
      this.randomBefore = undefined;
      this.randomAfter = undefined;
    } else {
      this.randomOn = random.on;
      this.randomBefore = random.before;
      this.randomAfter = random.after;
    }
    this.flicker = flicker;
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
    var startTime = new Date(this.startTime);
    switch(this.validityType) {
      case 'days':
        var validityDate = new Date(startTime.setDate(startTime.getDate() + index*this.delta));
        nowDate.setHours(0,0,0,0);
        validityDate.setHours(0,0,0,0);
        break;
      case 'hours':
        validityDate = new Date(startTime.setHours(startTime.getHours() + index*this.delta));
        nowDate.setMinutes(0,0,0);
        validityDate.setMinutes(0,0,0);
        break;
      case 'minutes':
        validityDate = new Date(startTime.setMinutes(startTime.getMinutes() + index*this.delta));
        nowDate.setSeconds(0,0);
        validityDate.setSeconds(0,0);
        break;
      case 'seconds':
        validityDate = new Date(startTime.setSeconds(startTime.getSeconds() + index*this.delta));
        nowDate.setMilliseconds(0);
        validityDate.setMilliseconds(0);
        break;
    }

    var nowDateTime = nowDate.getTime();
    var validityDateTime = validityDate.getTime();

    if(nowDateTime == validityDateTime){
      var state = 'on'
    } else if(nowDateTime < validityDateTime) {
      state = 'before';
    } else if(nowDateTime > validityDateTime){
      state = 'after';
    }
    return state;
  }

  isValidLed(led){
    if (this.getLedIndex(led) >= 0){
      return true;
    } else {
      return false;
    }
  }

  getLedIndex(led){
    return this.leds.findIndex(element => element == led)
  }

  getLedColor(led){
    var index = this.getLedIndex(led);
    var result = undefined;
    if (index>=0){
      if (this.validityType != 'timeless'){
        var state = this.getState(index);
      }else{
        state = this.state;
      }

      switch(state){
        case 'on':
          if (this.randomOn == "on"){
            result = this.getRandomColor();
          } else if (this.randomOn != "off"){
            result = this.colorOn;
          }
          break;
        case 'before':
          if (this.randomBefore == "on"){
            result = this.getRandomColor();
          } else if (this.randomBefore != "off"){
            result = this.colorBefore;
          }
          break;
        case 'after':
          if (this.randomAfter == "on"){
            result = this.getRandomColor();
          } else if (this.randomAfter != "off"){
            result = this.colorAfter;
          }
          break;
      }
    }
    return result;
  }
  getRandomColor(){
    var letters = '0123456789ABCDEF';
    var color = '0x';
    for (var i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  getFlicker(ledColor){
    if (this.flicker == "on"){
      var rgb = this.hex2rgb(ledColor);
      if (rgb != false){
        rgb.r = Math.max(0,Math.min((rgb.r + 10 - (20*Math.random())),255));
        rgb.g = Math.max(0,Math.min((rgb.g + 10 - (20*Math.random())),255));
        //rgb.g = Math.trunc(rgb.g + 5 - (10*Math.random()));
        //rgb.b = Math.trunc(rgb.b + 5 - (10*Math.random()));
        var color = (rgb.r << 16) | (rgb.g << 8)| rgb.b;
        var result = "0x" + color.toString(16);
      } else {
        result = ledColor;
      }
    } else {
      result = ledColor;
    }
    return result;
  }

  hex2rgb(hex) {
    var validHEXInput = /^0x?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!validHEXInput) {
      return false;
    }
    var output = {
        r: parseInt(validHEXInput[1], 16),
        g: parseInt(validHEXInput[2], 16),
        b: parseInt(validHEXInput[3], 16),
    };
    return output;
}
}

class Config {
  constructor(){
    var args = process.argv.slice(2);
    if(typeof args[0] === 'string' && args[0] != ''){
      this.configFile = args[0];
    }else{
      this.configFile = configFile;
    }
    this.config = jsonfile.readFileSync(this.configFile);
  }

  getBrightness(){
    return this.config.brightness;
  }

  getLedGroups(){
    var ledGroups = [];
    this.config.ledGroups.forEach(configEntry => {
      if (configEntry.timeUnit != "timeless"){
        if(this.config.startTime == "now"){
          var startTime = new Date();
        }else{
          var startTime = new Date(this.config.startTime);
        }
      }

      if(configEntry.offset == undefined){
        var offset = 0;
      } else {
        var offset = configEntry.offset;
      }

      switch(configEntry.timeUnit) {
        case 'days':
          startTime = new Date(startTime.setDate(startTime.getDate() + offset));
          break;
        case 'hours':
          startTime = new Date(startTime.setHours(startTime.getHours() + offset));
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
        configEntry.colors,
        configEntry.random,
        configEntry.flicker
      ));
    });
    return ledGroups;
  }
}

var main = new Main();
main.run();
