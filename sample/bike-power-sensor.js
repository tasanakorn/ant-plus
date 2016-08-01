'use strict';

let Ant = require('..');
let stick = new Ant.GarminStick2();
let bikePowerSensor = new Ant.BikePowerSensor(stick);


bikePowerSensor.on('powerData', data => {
  console.log(`id: ${data.DeviceID}, cadence: ${data.Cadence}, power: ${data.Power}`);
});


stick.on('startup', function () {
	console.log('startup');
	bikePowerSensor.attach(0, 0);
});

if (!stick.open()) {
	console.log('Stick not found!');
}
