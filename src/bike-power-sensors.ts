/// <reference path="../typings/index.d.ts"/>

import Ant = require('./ant');

const Constants = Ant.Constants;
const Messages = Ant.Messages;


class BikePowerSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	PedalPower: number;
	Cadence: number;
	AccumulatedPower: number;
	Power: number;
}

class BikePowerScanState extends BikePowerSensorState {
	Rssi: number;
	Threshold: number;
}

const updateState = function (sensor: BikePowerSensor | BikePowerScanner,
	state: BikePowerSensorState | BikePowerScanState, data: Buffer) {
	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	switch (page) {
		case 0x10:
			state.PedalPower = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA+2);
			state.Cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA+3);
			state.AccumulatedPower = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA+4);
			state.Power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA+6);
			sensor.emit('powerData', state);
			break;
	}
};

export class BikePowerSensor extends Ant.AntPlusSensor {
	channel: number;
	static deviceType = 0x0B;
	state: BikePowerSensorState;

	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, BikePowerSensor.deviceType, 0, 255, 8182);
		this.state = new BikePowerSensorState(deviceID);
	}

	decodeData(data: Buffer) {
		let channel = data.readUInt8(Messages.BUFFER_INDEX_CHANNEL_NUM);
		let type = data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE);

		if (channel !== this.channel) {
			return;
		}

		switch (type) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
				if (this.deviceID === 0) {
					this.write(Messages.requestMessage(this.channel, Constants.MESSAGE_CHANNEL_ID));
				}

				updateState(this, this.state, data);
				break;

			case Constants.MESSAGE_CHANNEL_ID:
				this.deviceID = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA);
				this.transmissionType = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
				this.state.DeviceID = this.deviceID;
				break;
			default:
				break;
		}
	}

}

export class BikePowerScanner extends Ant.AntPlusScanner {
	static deviceType = 0x0B;

	states: { [id: number]: BikePowerScanState } = {};

	constructor(stick) {
		super(stick);
		this.decodeDataCbk = this.decodeData.bind(this);
	}

	public scan() {
		super.scan('receive');
	}

	decodeData(data: Buffer) {
		if (data.length <= Messages.BUFFER_INDEX_EXT_MSG_BEGIN || !(data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x80)) {
			console.log('wrong message format');
			return;
		}

		let deviceId = data.readUInt16LE(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 1);
		let deviceType = data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 3);

		if (deviceType !== BikePowerScanner.deviceType) {
			return;
		}

		if (!this.states[deviceId]) {
			this.states[deviceId] = new BikePowerScanState(deviceId);
		}

		if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN) & 0x40) {
			if (data.readUInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 5) === 0x20) {
				this.states[deviceId].Rssi = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 6);
				this.states[deviceId].Threshold = data.readInt8(Messages.BUFFER_INDEX_EXT_MSG_BEGIN + 7);
			}
		}

		switch (data.readUInt8(Messages.BUFFER_INDEX_MSG_TYPE)) {
			case Constants.MESSAGE_CHANNEL_BROADCAST_DATA:
				updateState(this, this.states[deviceId], data);
				break;
			default:
				break;
		}
	}
}