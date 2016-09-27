import { EditorMode, JAVASCRIPT, C, PYTHON, RUST } from './CodeMirror';

// export const EXAMPLES: {text: string, mode: EditorMode}[] = [
//     {mode: JAVASCRIPT, text: 'foobar'},
//     {mode: C, text: 'barbar'},
//     {mode: PYTHON, text: 'bleepbelp'}
// ];

export const EXAMPLES: {text: string, mode: EditorMode}[] = [

    {
        mode: JAVASCRIPT,
        text: `\n\n\n\n
function eratosthenes(n) {
    // Eratosthenes algorithm to find all primes under n
    var array = [], upperLimit = Math.sqrt(n), output = [];

    // Make an array from 2 to (n - 1)
    for (var i = 0; i < n; i++) {
        array.push(true);
    }

    // Remove multiples of primes starting from 2, 3, 5,...
    for (var i = 2; i <= upperLimit; i++) {
        if (array[i]) {
            for (var j = i * i; j < n; j += i) {
                array[j] = false;
            }
        }
    }

    // All array[i] set to true are primes
    for (var i = 2; i < n; i++) {
        if (array[i]) {
            output.push(i);
        }
    }

    return output;
}`
    },
    {
        mode: C,
        text: `\n\n\n\n
static struct node *prev = NULL;

bool isBST(struct node* root)
{
    // traverse the tree in inorder fashion and keep track of prev node
    if (root)
    {
        if (!isBST(root->left))
          return false;

        // Allows only distinct valued nodes
        if (prev != NULL && root->data <= prev->data)
          return false;

        prev = root;

        return isBST(root->right);
    }

    return true;
}`
    },
    {
        mode: PYTHON,
        text: `\n\n\n\n
from bitarray import bitarray
import mmh3
 
class BloomFilter:
    
    def __init__(self, size, num_hashes = 10):
        self.size = size
        self.num_hashes = num_hashes
        self.bit_array = bitarray(size)
        self.bit_array.setall(0)
        
    def add(self, string):
        for seed in xrange(self.num_hashes):
            result = mmh3.hash(string, seed) % self.size
            self.bit_array[result] = 1
            
    def might_have(self, string):
        for seed in xrange(self.num_hashes):
            result = mmh3.hash(string, seed) % self.size
            if self.bit_array[result] == 0:
                return False
        return True
`
    },
    {
        mode: RUST,
        text: `\n\n\n\n
fn fib(x: int) -> int {
    match x {
        0 | 1 => x,
        _     => fib(x - 1) + fib(x - 2),
    }
}

fn main() {
    let number = 20;
    println(fmt!("%?th fib number is: %?", number, fib(number)));
}`
    }

];
