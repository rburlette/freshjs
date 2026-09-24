import {FreshTable, rowTemplate} from '../fresh-table.js';
import {buildData} from '../data.js';
const buttons = [['run','Create 1,000 rows'],['runlots','Create 10,000 rows'],['add','Append 1,000 rows'],['update','Update every 10th row'],['clear','Clear'],['swaprows','Swap Rows']];
const template = `<link href="/css/currentStyle.css" rel="stylesheet">
<div class="container"><div class="jumbotron"><div class="row">
<div class="col-md-6"><h1>FreshJS (keyed)</h1></div>
<div class="col-md-6"><div class="row">${buttons.map(([id,label]) => `<div class="col-sm-6 smallpad"><button type="button" class="btn btn-primary btn-block" id="${id}" [.onclick]="() => this.${id}()">${label}</button></div>`).join('')}</div></div>
</div></div><table class="table table-hover table-striped test-data"><tbody>${rowTemplate}</tbody></table>
<span class="preloadicon glyphicon glyphicon-remove" aria-hidden="true"></span></div>`;
class BenchmarkApp extends FreshTable {
  constructor() { super(template); }
  run() { this.rows = buildData(1000); this.selected = null; this.refresh(); }
  runlots() { this.rows = buildData(10000); this.selected = null; this.refresh(); }
  add() { this.rows = this.rows.concat(buildData(1000)); this.refresh(); }
  update() {
    for(let i=0; i<this.rows.length; i+=10) this.rows[i].label += ' !!!';
    this.refresh();
  }
  clear() { this.rows = []; this.selected = null; this.refresh(); }
  swaprows() {
    if(this.rows.length > 998) [this.rows[1], this.rows[998]] = [this.rows[998], this.rows[1]];
    this.refresh();
  }
}
customElements.define('fresh-benchmark-app', BenchmarkApp);
