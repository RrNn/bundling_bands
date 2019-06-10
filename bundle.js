const fs = require('fs');
const path = require('path');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;
const babel = require('babel-core');

let ID = 0;

function createAsset(fileName) {
	const content = fs.readFileSync(fileName, 'utf-8');
	const ast = babylon.parse(content, {
		sourceType: 'module',
	});

	let dependencies = [];

	traverse(ast, {
		ImportDeclaration: ({ node }) => {
			dependencies.push(node.source.value);
		},
	});

	const id = ID++;

	const { code } = babel.transformFromAst(ast, null, {
		presets: ['env'],
	});

	return {
		id,
		fileName,
		dependencies,
		code,
	};
}

function createGraph(entryFile) {
	const mainAsset = createAsset(entryFile);

	const queue = [mainAsset];

	for (const asset of queue) {
		const dirname = path.dirname(asset.fileName);

		asset.mapping = {};

		asset.dependencies.forEach(relativePath => {
			const absolutepath = path.join(dirname, relativePath);

			const child = createAsset(absolutepath);

			asset.mapping[relativePath] = child.id;

			queue.push(child);
		});
	}
	return queue;
}

function bundle(graph) {
	let modules = '';

	graph.forEach(mod => {
		modules += `${mod.id}:[
		function(require, module, exports){
			${mod.code}
		},
		${JSON.stringify(mod.mapping)},
		],`;
	});

	const result = `
	(function(modules){
		function require(id){
			const [fn, mapping] = modules[id];

			function localRequire(relativePath){
				return require(mapping[relativePath]);
			}

			const module = {exports:{}};

			fn(localRequire, module, module.exports)

			return module.exports
		}
		require(0)

	})({${modules}})
	`;

	return result;
}

const graph = createGraph('./example/entry.js');
const result = bundle(graph);
console.log(result);
