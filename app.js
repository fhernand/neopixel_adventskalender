var ws281x = require('rpi-ws281x');

class Main {

    constructor() {
        // Current pixel position
        this.offset = 0;

        this.config = {};

        // Number of leds in my strip
        this.config.leds = 50;

        // Use DMA 10 (default 10)
        this.config.dma = 10;

        // Set full brightness, a value from 0 to 255 (default 255)
        this.config.brightness = 100;

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

        var now = new Date;

        this.ledGroups = [
          new ledGroup([0,3,4,7,8,11,12,15,16,19,20,23,24,27,28,31,32,35,36,39,40,43,44,47,48],now, 'seconds', {"on": "0xBEFF33", "before": "0x5A0AAB", "after":"0xE85D13"}),
          new ledGroup([4,11,18],now, 'seconds', {"on": "0x10FF33", "before": "0x100AAB", "after":"0x105D13"}),
          new ledGroup([1,2,5,6,9,10,13,14,17,18,21,22,25,26,29,30,33,34,37,38,41,42,45,46,49],0, 'timeless', {"on": "0xFFFFFF"})
        ];

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
          if (ledColor == undefined){
            ledColor = ledGroup.getLedColor(this.offset);
            if (ledColor != undefined){
              this.pixels[this.offset] = ledColor;
            }
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
  constructor(ledArray, startTime, validityType, colors){
    this.startTime = new Date(startTime);
    this.leds = ledArray;
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
    if (this.state == 'after' || this.validityType = 'timeless')
      return this.state;

    var nowDate = new Date();
    switch(this.validityType) {
      case 'date':
        var now = nowDate.getDate();
        var validity = this.startTime.setDate(this.startTime.getDate() + index);
        break;
      case 'hours':
        var now = nowDate.getHours();
        validity = this.startTime.getHours(this.startTime.getHours() + index);
        break;
      case 'minutes':
        var now = nowDate.getMinutes();
        validity = this.startTime.setMinutes(this.startTime.getMinutes() + index);
        break;
      case 'seconds':
        var now = nowDate.getSeconds();
        validity = this.startTime.setSeconds(this.startTime.getSeconds() + index);
        break;
    }

    if(now == validity){
      this.state = 'on'
    } else if(nowDate < this.startTime) {
      this.state = 'before';
    } else {
      this.state = 'after';
    }
    return this.state;
  }

  getLedColor(led){
    var index = this.leds.findIndex(element => element == led);
    if (index!=undefined){
      var state = this.getState(index);
      switch(state){
        case 'on':
          return this.colorOn;
        case 'before':
          return this.colorBefore;
        case 'after':
          return this.colorAfter;
      }
    }else{
      return undefined;
    }
  }


}

var main = new Main();
main.run();
