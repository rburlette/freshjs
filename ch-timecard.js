import {freshElement} from './fresh.js';
import {createSampleWeek} from './timecard-model.js';
import './ch-timecard-day.js';

const templateString = /*html*/`
<style>
    :host {
        display: flex;
        width: 100%;
        border-top: 1px solid lightgrey;
        border-left: 1px solid lightgrey;
    }
</style>
<ch-timecard-day fjs-for="day in this.days" [.day]="day"></ch-timecard-day>
`;

// A week of shifts: ch-timecard shows a ch-timecard-day for each day, which shows a
// ch-timecard-shift for each shift. The rules for changing times live in timecard-model.js.
class chTimeCard extends freshElement {
    constructor() {
        super(templateString);

        this.days = createSampleWeek();
    }
}

customElements.define('ch-timecard', chTimeCard);
