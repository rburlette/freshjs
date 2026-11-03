import {freshElement} from '../../fresh.js';
import * as timecard from './timecard-model.js';

const templateString = /*html*/`
<style>
    :host {
        display: block;
        margin: 4px 0;
        border: 1px solid #3d3d3d;
        border-top-left-radius: 3px;
        border-top-right-radius: 3px;
    }

    header {
        background: #3d3d3d;
        font-size: 12px;
        color: #fff;
        font-weight: bold;
        text-align: center;
    }

    label {
        display: block;
        font-size: 12px;
    }

    .flex-lr {
        display: flex;
        justify-content: space-between;
    }

    .flex-lr label {
        padding: 0 3px;
    }

    .flex-lr select {
        margin: 1px 2px;
    }

    select {
        background: #ffffff;
        border: 1px solid lightgrey;
        font-size: 12px;
    }

    .changed {
        background: rgba(255, 255, 0, 0.59);
    }

    .total {
        color: rgb(255, 255, 255);
        background: #575757;
        font-size: 11px;
        font-weight: bold;
    }

    .total .changed {
        color: yellow;
        background: inherit;
    }

    .services {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }

    .services li[data-service="1"] {
        background-color: #dbedf5;
    }

    .services li[data-service="2"] {
        background-color: #baf8d4;
    }

    .services li[data-service="3"] {
        background-color: #d1d1ff;
    }

    .services li[data-new] {
        border: 1px solid yellow;
    }

    .adj-container {
        margin: 0 2px;
        display: inline-flex;
    }

    .adj-container button {
        font-size: 11px;
        margin: 1px 0;
        padding: 0px 5px;
    }

    .toolbar {
        display: flex;
    }

    .toolbar button {
        font-size: 12px;
        flex: 0 1 50%;
        padding: 1px;
    }
</style>
<header>Shift {{this.number}}</header>
<div class="flex-lr">
    <label>In:</label>
    <select [.value]="this.shift.in.toJSON()" (change)="this.changeIn(event.target.value)" [class]="this.inClass()">
        <option fjs-for="time in this.times" [.value]="time.value">{{time.text}}</option>
    </select>
</div>
<div class="flex-lr">
    <label>Out:</label>
    <select [.value]="this.shift.out.toJSON()" (change)="this.changeOut(event.target.value)" [class]="this.outClass()">
        <option fjs-for="time in this.times" [.value]="time.value" [.disabled]="time.date < this.shift.in">{{time.text}}</option>
    </select>
</div>
<div class="total flex-lr">
    <label>Shift Total:</label>
    <label [class]="this.durationClass(this.shift)">{{this.shift.duration}}hrs</label>
</div>
<ol class="services">
    <li fjs-for="job in this.shift.jobs" [data-service]="job.service" [data-new]="job.isNew">
        <div fjs-if="this.showDetails(job)">
            <div class="flex-lr">
                <label>Service: </label>
                <select [.value]="job.service" [.disabled]="!job.isNew" (change)="this.changeService(job, event.target.value)">
                    <option fjs-for="service in this.remainingServices(job)" [.value]="service.value">{{service.name}}</option>
                </select>
            </div>
            <div class="flex-lr">
                <label>Payer:</label>
                <select [.value]="job.payerId" [.disabled]="!job.isNew" (change)="this.changePayer(job, event.target.value)">
                    <option fjs-for="payer in this.payers" [.value]="payer.value">{{payer.name}}</option>
                </select>
            </div>
        </div>
        <div class="flex-lr">
            <label>{{this.showDetails(job) ? 'Duration' : this.serviceName(job)}}:</label>
            <div class="adj-container">
                <label [class]="this.durationClass(job)">{{job.duration}}hrs</label>
                <button [.disabled]="this.atEndOfDay" (click)="this.addTime(job, 15)">+</button>
                <button [.disabled]="job.duration === 0" (click)="this.addTime(job, -15)">-</button>
            </div>
        </div>
    </li>
</ol>
<div class="toolbar">
    <button (click)="this.toggleDetails()">{{this.shift.showDetails ? 'Hide' : 'Show'}} Details</button>
    <button [.disabled]="this.shift.jobs.length >= this.services.length" (click)="this.addService()">Add Service</button>
</div>
`;

// One shift card. The day passes in [.shift], [.number] and [.times].
// Clicks here only change this shift, so the automatic refresh after each event updates just this card.
class chTimeCardShift extends freshElement {
    constructor() {
        super(templateString);

        this.services = timecard.services;
        this.payers = timecard.payers;
    }

    get atEndOfDay() {
        return this.shift.out.getTime() === this.shift.maxTime.getTime();
    }

    showDetails(job) {
        return this.shift.showDetails || job.isNew;
    }

    serviceName(job) {
        return this.services.find(service => service.value === job.service).name;
    }

    remainingServices(job) {
        return timecard.getRemainingServices(this.shift, job);
    }

    // anything that differs from what was scheduled is highlighted
    inClass() {
        return (this.shift.isNew || this.shift.in.getTime() !== this.shift.needIn.getTime()) && 'changed';
    }

    outClass() {
        return (this.shift.isNew || this.shift.out.getTime() !== this.shift.needOut.getTime()) && 'changed';
    }

    durationClass(item) {
        return (item.isNew || item.duration !== item.needDuration) && 'changed';
    }

    changeIn(value) {
        timecard.changeShiftIn(this.shift, value);
    }

    changeOut(value) {
        timecard.changeShiftOut(this.shift, value);
    }

    addTime(job, minutes) {
        timecard.addTime(this.shift, job, minutes);
    }

    addService() {
        timecard.addService(this.shift);
    }

    changeService(job, value) {
        job.service = Number(value);
    }

    changePayer(job, value) {
        job.payerId = Number(value);
    }

    toggleDetails() {
        this.shift.showDetails = !this.shift.showDetails;
    }
}

customElements.define('ch-timecard-shift', chTimeCardShift);
