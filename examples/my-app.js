import {freshElement} from '../fresh.js';
import './timecard/ch-timecard.js';
import './tic-tac-toe/ttt-game.js';
import './hero/hero.js';

const templateString = /*html*/`
<style>
    :host {
        display: block;
    }

    section {
        margin: 24px 0;
    }

    h2 {
        margin: 0;
        font-size: 20px;
    }

    p {
        margin: 4px 0 12px;
        color: #555;
    }

    .games {
        display: flex;
        flex-wrap: wrap;
    }
</style>
<section>
    <h2>Timecard</h2>
    <p>Nested components (week, day, shift) with the rules in a plain module. Try + and -, the In and Out times, and Add Service.</p>
    <ch-timecard></ch-timecard>
</section>
<section>
    <h2>Tic-tac-toe</h2>
    <p>Two copies of the same component, each keeping its own state.</p>
    <div class="games">
        <ttt-game></ttt-game>
        <ttt-game></ttt-game>
    </div>
</section>
<section>
    <h2>Hero editor</h2>
    <p>The Hero Editor from the Angular tutorial. Type "bob" as the name to see fjs-if.</p>
    <fjs-hero></fjs-hero>
</section>
`;

class myApp extends freshElement {
    constructor() {
        super(templateString);
    }
}

customElements.define('my-app', myApp);
