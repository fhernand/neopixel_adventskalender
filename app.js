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

        this.ledGroups = [];
        var now = new Date;

        for (var i = 0; i < this.config.leds; i++){
          this.ledGroups.push(new ledGroup([i],now.setSeconds( now.getSeconds() + 1), 'seconds', {"on": '0xBEFF33', 'before': '0x5A0AAB', 'after':"0xE85D13"}));
        }

    }

    loop() {
        var pixels = new Uint32Array(this.config.leds);

        var ledColor = undefined;
        this.ledGroups.forEach(ledGroup => {
          if (ledColor == undefined){
            ledColor = ledGroup.getLedColor(this.offset);
            if (ledColor != undefined){
              pixels[this.offset] = ledColor;
            }
          }
        });

        // Move on to next
        this.offset = (this.offset + 1) % this.config.leds;

        // Render to strip
        ws281x.render(pixels);
    }

    run() {
        // Loop every n ms
        setInterval(this.loop.bind(this), 100);
    }

};

class ledGroup {
  constructor(ledArray, Date validity, validityType, colors){
    this.leds = ledArray;
    this.validityType = validityType;
    Date this.validity = validity;
    this.colorOn = colors.on;
    this.colorBefore = colors.before;
    this.colorAfter = colors.after;
  }

  getState(){
    var nowDate = new Date();
    switch(this.validityType) {
      case 'date':
        var now = nowDate.getDate();
        var validity = this.validity.getDate();
        break;
      case 'hours':
        var now = nowDate.getHours();
        validity = this.validity.getHours();
        break;
      case 'minutes':
        var now = nowDate.getMinutes();
        validity = this.validity.getMinutes();
        break;
      case 'seconds':
        var now = nowDate.getSeconds();
        validity = this.validity.getSeconds();
        break;
    }

    console.log(now);
    console.log(validity);

    if(now == validity){
      return 'on';
    } else if(now < validity) {
      return 'before';
    } else if(nowDate > validity) {
      return 'after';
    }
  }

  getLedColor(led){
    if (this.leds.find(element => element == led)!=undefined){
      var state = this.getState();
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
