import {freshElement} from './fresh.js';
import './ttt-board.js';

const templateString = /*html*/`
<style>
    :host {
        display: flex;
        flex-wrap: nowrap;
        margin: 20px;
    }

    .game-info {
        margin-left: 20px;
    }
</style>
<ttt-board [.squares]="this.history[this.stepNumber]" (square-click)="this.handleSquareClick(event.detail)"></ttt-board>
<div class="game-info">
    <div>{{this.statusMsg}}</div>
    <ol>
        <li fjs-for="this.history">
            <button (click)="this.jumpTo(index)">{{this.moveText(index)}}</button>
        </li>
    </ol>
</div>
`;

class tttGame extends freshElement {
    constructor() {
        super(templateString);

        this.history = [
            Array(9).fill(null)
        ];

        this.stepNumber = 0;
        this.xIsNext =  true;
    }

    moveText(turnNumber) {
        return turnNumber === 0 ? 'Go to game start' : 'Go to move #' + turnNumber;
    }

    handleSquareClick(squareIndex) {
        const currentSquares = this.history[this.stepNumber];

        if (this.calculateWinner(currentSquares) || currentSquares[squareIndex])
            return;

        this.stepNumber++;

        this.history[this.stepNumber] = currentSquares.slice();

        this.history[this.stepNumber][squareIndex] = this.xIsNext ? 'X' : 'O';

        if((this.history.length - 1) > this.stepNumber)
            this.history = this.history.slice(0, this.stepNumber + 1);

        this.xIsNext = !this.xIsNext;
    }

    jumpTo(step) {
        this.stepNumber = step;
        this.xIsNext = (step % 2) === 0;
    }

    get statusMsg() {
        let winner = this.calculateWinner(this.history[this.stepNumber]);

        if (winner)
            return 'Winner: ' + winner;

        return 'Next player: ' + (this.xIsNext ? 'X' : 'O');
    }

    calculateWinner(squares) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i];
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
            }
        }
        return null;
    }
}

customElements.define('ttt-game', tttGame);