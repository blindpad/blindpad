import * as CodeMirror from 'codemirror';
require('../../node_modules/codemirror/lib/codemirror.css');

require('../../node_modules/codemirror/theme/monokai.css');

require('../../node_modules/codemirror/addon/selection/active-line');
require('../../node_modules/codemirror/addon/edit/closebrackets');
require('../../node_modules/codemirror/addon/edit/matchbrackets');

require('../../node_modules/codemirror/mode/clike/clike.js');
require('../../node_modules/codemirror/mode/clojure/clojure.js');
require('../../node_modules/codemirror/mode/coffeescript/coffeescript.js');
require('../../node_modules/codemirror/mode/css/css.js');
require('../../node_modules/codemirror/mode/dockerfile/dockerfile.js');
require('../../node_modules/codemirror-mode-elixir/dist/elixir.js');
require('../../node_modules/codemirror/mode/erlang/erlang.js');
require('../../node_modules/codemirror/mode/elm/elm.js');
require('../../node_modules/codemirror/mode/go/go.js');
require('../../node_modules/codemirror/mode/haskell/haskell.js');
require('../../node_modules/codemirror/mode/htmlmixed/htmlmixed.js');
require('../../node_modules/codemirror/mode/javascript/javascript.js');
require('../../node_modules/codemirror/mode/jsx/jsx.js');
require('../../node_modules/codemirror/mode/julia/julia.js');
require('../../node_modules/codemirror/mode/markdown/markdown.js');
require('../../node_modules/codemirror/mode/octave/octave.js');
require('../../node_modules/codemirror/mode/perl/perl.js');
require('../../node_modules/codemirror/mode/php/php.js');
require('../../node_modules/codemirror/mode/python/python.js');
require('../../node_modules/codemirror/mode/r/r.js');
require('../../node_modules/codemirror/mode/rst/rst.js');
require('../../node_modules/codemirror/mode/ruby/ruby.js');
require('../../node_modules/codemirror/mode/rust/rust.js');
require('../../node_modules/codemirror/mode/sass/sass.js');
require('../../node_modules/codemirror/mode/shell/shell.js');
require('../../node_modules/codemirror/mode/sql/sql.js');
require('../../node_modules/codemirror/mode/swift/swift.js');
require('../../node_modules/codemirror/mode/vb/vb.js');

export interface EditorMode {
    name: string;
    mime?: string;
    children?: EditorMode[];
}

export const DEFAULT_MODE: EditorMode = { name: 'Plaintext', mime: 'text/plain', children: [] };
export const JAVASCRIPT: EditorMode = { name: 'JavaScript', mime: 'application/javascript', children: [] };
export const C: EditorMode = { name: 'C', mime: 'text/x-c', children: [] };
export const PYTHON: EditorMode = { name: 'Python', mime: 'text/x-python', children: [] };
export const RUST: EditorMode = { name: 'Rust', mime: 'text/x-rustsrc', children: [] };

export const MODES: EditorMode[] = filterModes([
    DEFAULT_MODE,
    { name: 'Markdown', mime: 'text/x-markdown', children: [] },
    C,
    { name: 'C++', mime: 'text/x-c++src', children: [] },
    { name: 'Java', mime: 'text/x-java', children: [] },
    { name: 'C#', mime: 'text/x-csharp', children: [] },
    { name: 'Scala', mime: 'text/x-scala', children: [] },
    { name: 'Kotlin', mime: 'text/x-kotlin', children: [] },
    {
        name: 'GLSL', children: [
            { name: 'Vertex Shader', mime: 'x-shader/x-vertex', children: [] },
            { name: 'Fragment Shader', mime: 'x-shader/x-fragment', children: [] }
        ]
    },
    { name: 'Objective C', mime: 'text/x-objectivec', children: [] },
    { name: 'Clojure', mime: 'text/x-clojure', children: [] },
    { name: 'ClojureScript', mime: 'text/x-clojurescript', children: [] },
    {
        name: 'CSS flavors', children: [
            { name: 'CSS', mime: 'text/css', children: [] },
            { name: 'SCSS', mime: 'text/x-scss', children: [] },
            { name: 'Sass', mime: 'text/x-sass', children: [] },
            { name: 'LESS', mime: 'text/x-less', children: [] }
        ]
    },
    JAVASCRIPT,
    { name: 'TypeScript', mime: 'application/typescript', children: [] },
    { name: 'CoffeeScript', mime: 'text/coffeescript', children: [] },
    { name: 'JSX', mime: 'text/jsx', children: [] },
    { name: 'JSON', mime: 'application/json', children: [] },
    { name: 'Julia', mime: 'text/x-julia', children: [] },
    { name: 'MATLAB', mime: 'text/x-octave', children: [] },
    { name: 'R', mime: 'text/x-rsrc', children: [] },
    { name: 'reStructuredText', mime: 'text/x-rst', children: [] },
    {
        name: 'SQL', children: [
            { name: 'ANSI SQL', mime: 'text/x-sql', children: [] },
            { name: 'Microsoft SQL', mime: 'text/x-mssql', children: [] },
            { name: 'MySQL', mime: 'text/x-mysql', children: [] },
            { name: 'MariaDB', mime: 'text/x-mariadb', children: [] },
            { name: 'Cassandra', mime: 'text/x-cassandra', children: [] },
            { name: 'PL/SQL', mime: 'text/x-plsql', children: [] },
            { name: 'HiveQL', mime: 'text/x-hive', children: [] },
            { name: 'Postgres', mime: 'text/x-pgsql', children: [] },
            { name: 'GQL', mime: 'text/x-gql', children: [] }
        ]
    },
    { name: 'Dockerfile', mime: 'text/x-dockerfile', children: [] },
    { name: 'Elixir', mime: 'text/x-elixir', children: [] },
    { name: 'Erlang', mime: 'text/x-erlang', children: [] },
    { name: 'Elm', mime: 'text/x-elm', children: [] },
    { name: 'Go', mime: 'text/x-go', children: [] },
    { name: 'Haskell', mime: 'text/x-haskell', children: [] },
    { name: 'XML', mime: 'application/xml', children: [] },
    { name: 'HTML', mime: 'text/html', children: [] },
    { name: 'Perl', mime: 'text/x-perl', children: [] },
    { name: 'PHP', mime: 'text/x-php', children: [] },
    PYTHON,
    { name: 'Ruby', mime: 'text/x-ruby', children: [] },
    RUST,
    { name: 'Bash', mime: 'text/x-sh', children: [] },
    { name: 'Swift', mime: 'text/x-swift', children: [] },
    { name: 'Visual Basic', mime: 'text/x-vb', children: [] }
]);

const MIME_TO_MODE = indexModes(MODES);

const UNKNOWN_MODE: EditorMode = { name: 'Unknown', mime: DEFAULT_MODE.mime, children: [] };

export const DEFAULT_EDITOR_CONFIG = {
    theme: 'monokai',
    lineNumbers: true,
    lineWrapping: true,
    styleActiveLine: true,
    autofocus: true,
    mode: DEFAULT_MODE.mime,
    viewportMargin: Infinity,
    autoCloseBrackets: true,
    matchBrackets: true
} as CodeMirror.EditorConfiguration;

export function buildEditor(host: HTMLElement, options = DEFAULT_EDITOR_CONFIG) {
    return CodeMirror(host, options);
}

export function getModeForMime(mime: string) {
    if (!mime) return DEFAULT_MODE;
    return MIME_TO_MODE[mime] || UNKNOWN_MODE;
}

function filterModes(modes: EditorMode[]): EditorMode[] {
    if (!modes || modes.length === 0) return [];
    const availableMimes = CodeMirror['mimeModes'];
    const result: EditorMode[] = [];
    modes.forEach(mode => {
        const children = filterModes(mode.children);
        if (children.length > 0 || availableMimes[mode.mime] !== undefined) {
            mode.children = children;
            result.push(mode);
        }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
}

function indexModes(modes: EditorMode[], soFar: { [key: string]: EditorMode } = {}): { [key: string]: EditorMode } {
    if (!modes || modes.length === 0) return soFar;
    modes.forEach(mode => {
        if (mode.mime) soFar[mode.mime] = mode;
        indexModes(mode.children, soFar);
    });
    return soFar;
}
