"""Offline reflection shared by CPython and the pinned browser Pyodide runtime.

Run after the application's unmodified-at-call-time JSON bridge. Only imports,
source reads and static inspection are performed; no engineering callable is run.
Observed docstrings/types/units are deliberately separate from reviewed contracts.
"""
import ast
import collections
import hashlib
import importlib
import importlib.metadata
import inspect
import json
import math
import pathlib
import re
import textwrap


REGISTRY_PACKAGES = {'ht': '1.2.0', 'fluids': '1.3.1'}
_registry_runtime_signatures = {}


def _registry_hash(raw):
    return hashlib.sha256(raw).hexdigest()


def _registry_path(path, roots):
    path = pathlib.Path(path).resolve()
    for package, root in roots.items():
        try:
            return package + '/' + path.relative_to(root).as_posix()
        except ValueError:
            pass
    return None


def _registry_default(value, roots):
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else {'kind': 'nonfinite', 'value': str(value)}
    if isinstance(value, str):
        # A default data-file location is environment-specific, not an API ID.
        for root in roots.values():
            parent = str(root.parent).replace('\\', '/')
            if value.replace('\\', '/').startswith(parent + '/'):
                return {'kind': 'package-path', 'value': value.replace('\\', '/')[len(parent) + 1:]}
        return value
    if callable(value):
        return {'kind': 'callable', 'definition': getattr(value, '__module__', '') + '.' +
                getattr(value, '__qualname__', type(value).__qualname__)}
    if isinstance(value, (tuple, list)):
        return {'kind': type(value).__name__, 'items': [_registry_default(v, roots) for v in value]}
    if isinstance(value, dict) and all(isinstance(k, str) for k in value):
        return {'kind': 'dict', 'items': {k: _registry_default(v, roots) for k, v in sorted(value.items())}}
    return {'kind': 'object', 'type': type(value).__module__ + '.' + type(value).__qualname__,
            'valueStatus': 'not_serialized'}


def _registry_annotation(value):
    if value is inspect.Parameter.empty:
        return None
    return value if isinstance(value, str) else inspect.formatannotation(value)


def _registry_signature(target, roots):
    try:
        signature = inspect.signature(target)
    except (TypeError, ValueError):
        return {'status': 'unavailable', 'parameters': [], 'returnAnnotation': None}
    parameters = []
    for item in signature.parameters.values():
        parameter = {'name': item.name, 'kind': item.kind.name,
                     'required': item.default is inspect.Parameter.empty and item.kind not in
                     (item.VAR_POSITIONAL, item.VAR_KEYWORD),
                     'annotation': _registry_annotation(item.annotation)}
        if item.default is not inspect.Parameter.empty:
            parameter['default'] = _registry_default(item.default, roots)
        parameters.append(parameter)
    return {'status': 'observed', 'parameters': parameters,
            'returnAnnotation': _registry_annotation(signature.return_annotation)}


def _registry_signature_observation(target, source, key, roots):
    signature = _registry_signature(target, roots)
    if source['status'] != 'pinned-package-source':
        _registry_runtime_signatures[key] = signature
        return {'status': 'runtime-dependent', 'parameters': [], 'returnAnnotation': None,
                'observationKey': key}
    return signature


def _registry_doc_sections(doc):
    sections, active = {}, 'Summary'
    lines = doc.splitlines()
    for index, line in enumerate(lines):
        if index + 1 < len(lines) and line and not line.startswith(' ') and re.fullmatch('-{3,}', lines[index + 1]):
            active = line
            sections.setdefault(active, [])
            continue
        if re.fullmatch('-{3,}', line):
            continue
        sections.setdefault(active, []).append(line)
    return {name: '\n'.join(text).strip() for name, text in sorted(sections.items())}


def _registry_source(target, roots, sources):
    try:
        file = inspect.getsourcefile(target)
        if not file:
            return {'status': 'dependency_or_builtin'}
        relative = _registry_path(file, roots)
        if relative is None:
            return {'status': 'dependency_or_builtin'}
        path = pathlib.Path(file)
        raw = path.read_bytes()
        sources[relative] = _registry_hash(raw)
        try:
            _, line = inspect.getsourcelines(target)
        except (OSError, TypeError):
            line = None
        return {'status': 'pinned-package-source', 'path': relative, 'line': line,
                'sha256': sources[relative]}
    except (OSError, TypeError):
        return {'status': 'unavailable'}


def _registry_stages(catalog=True):
    return {'catalog': 'observed' if catalog else 'member_only',
            'types': 'unreviewed', 'units': 'unreviewed', 'geometry': 'unreviewed',
            'domain': 'unreviewed', 'dependencies': 'unreviewed',
            'numerical': 'unreviewed', 'dedicatedUI': 'unreviewed',
            'persistence': 'unreviewed', 'exports': 'unreviewed', 'coldOffline': 'unreviewed'}


def _registry_documentation(target, source):
    doc = inspect.cleandoc(getattr(target, '__doc__', None) or '') if source['status'] == 'pinned-package-source' else ''
    sections = _registry_doc_sections(doc)
    return {'summary': sections.get('Summary', ''), 'parameters': sections.get('Parameters', ''),
            'returns': sections.get('Returns', ''), 'notes': sections.get('Notes', ''),
            'raises': sections.get('Raises', ''), 'references': sections.get('References', ''),
            'parsedUnits': _library_doc_units(doc), 'reviewStatus': 'unreviewed'}


def _registry_module_details(name, roots, sources):
    module = importlib.import_module(name)
    file = getattr(module, '__file__', None)
    relative = _registry_path(file, roots) if file else None
    if not relative or not str(file).endswith('.py'):
        return {'module': name, 'sourceStatus': 'unavailable'}
    raw = pathlib.Path(file).read_bytes()
    sources[relative] = _registry_hash(raw)
    tree = ast.parse(raw)
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add('.' * node.level + node.module)
    return {'module': name, 'sourceStatus': 'pinned-package-source', 'path': relative,
            'sha256': sources[relative], 'importsObserved': sorted(imports),
            'dependencyQualification': 'Static imports only; transitive/lazy/data/network requirements need review.',
            'publicListing': '__all__' if hasattr(module, '__all__') else 'non_private_fallback'}


def _registry_unavailable_details(item, roots, sources):
    name = item['module']
    package, *parts = name.split('.')
    stem = roots[package].joinpath(*parts)
    file = stem.with_suffix('.py') if stem.with_suffix('.py').is_file() else stem / '__init__.py'
    result = dict(item)
    if not file.is_file():
        result['sourceStatus'] = 'unavailable'
        return result
    raw = file.read_bytes()
    relative = _registry_path(file, roots)
    sources[relative] = _registry_hash(raw)
    tree = ast.parse(raw)
    imports, declared = set(), None
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add('.' * node.level + node.module)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == '__all__' for t in node.targets):
            try:
                value = ast.literal_eval(node.value)
                if isinstance(value, (list, tuple)) and all(isinstance(v, str) for v in value):
                    declared = sorted(set(value))
            except (ValueError, TypeError):
                pass
    result.update({'sourceStatus': 'pinned-package-source', 'path': relative,
                   'sha256': sources[relative], 'importsObserved': sorted(imports),
                   'literalExportCandidates': declared, 'exportScopeStatus': 'unresolved_optional_variant',
                   'qualification': 'Source inspected without importing the missing dependency. Literal names do not enumerate dynamic wrappers.'})
    return result


def collect_library_registry():
    _registry_runtime_signatures.clear()
    roots = {name: pathlib.Path(importlib.import_module(name).__file__).resolve().parent
             for name in REGISTRY_PACKAGES}
    sources, records, path_index, packages = {}, [], {}, []
    for package, version in REGISTRY_PACKAGES.items():
        if importlib.metadata.version(package) != version:
            raise ValueError('Registry requires pinned ' + package + ' ' + version)
        catalog = _library_catalog(package)
        targets = _library_catalog.__globals__['_library_targets'][package]
        descriptions = {entry['path']: entry for entry in catalog['entries']}
        grouped = collections.defaultdict(list)
        for name, value in targets.items():
            if callable(value):
                grouped[id(value)].append(name)
        identities, package_records = {}, []
        for aliases in grouped.values():
            aliases = sorted(set(aliases))
            value = targets[aliases[0]]
            definition = getattr(value, '__module__', '') + '.' + getattr(value, '__qualname__', '')
            canonical = definition if definition in aliases else min(aliases, key=lambda p: (p.count('.'), len(p), p))
            rid = package + '@' + version + ':' + canonical
            identities[id(value)] = rid
            source_value = value.pyfunc if isinstance(value, np.vectorize) else value
            source = _registry_source(source_value, roots, sources)
            # Builtin/dependency docstrings vary by interpreter and are not owned by these wheels.
            row = {'id': rid, 'package': package, 'version': version,
                   'kind': 'class' if inspect.isclass(value) else 'function',
                   'canonical': canonical, 'aliases': aliases, 'definition': definition,
                   'adapter': 'numpy.vectorize' if isinstance(value, np.vectorize) else None,
                   'source': source, 'signature': _registry_signature_observation(value, source, rid, roots),
                   'upstreamDocumentation': _registry_documentation(source_value, source),
                   'contracts': {'types': None, 'units': None, 'geometry': None, 'domain': None,
                                 'dependencies': None},
                   'stages': _registry_stages(), 'evidence': [],
                   'knownIssues': descriptions[canonical].get('knownIssues', [])}
            if row['knownIssues']:
                row['stages']['numerical'] = 'known_discrepancy'
            package_records.append(row)
            for alias in aliases:
                path_index[alias] = rid
        for row in package_records:
            target = targets[row['canonical']]
            if isinstance(target, np.vectorize):
                row['baseObjectId'] = identities.get(id(target.pyfunc))
                row['baseSignature'] = _registry_signature(target.pyfunc, roots)
                if row['baseObjectId']:
                    row['upstreamDocumentation'] = {'inheritedFrom': row['baseObjectId'], 'reviewStatus': 'unreviewed'}
        for name, value in sorted(targets.items()):
            if callable(value):
                continue
            rid = package + '@' + version + ':' + name
            path_index[name] = rid
            package_records.append({'id': rid, 'package': package, 'version': version, 'kind': 'data',
                'canonical': name, 'aliases': [name],
                'observedType': type(value).__module__ + '.' + type(value).__qualname__,
                'source': {'status': 'module-binding', 'module': name.rsplit('.', 1)[0]},
                'contracts': {'types': None, 'units': None, 'geometry': None, 'domain': None, 'dependencies': None},
                'stages': _registry_stages(), 'evidence': [],
                'qualification': 'Data bindings are not merged by equal value; lazy data may not be loaded.'})
        members, instance_attributes = [], []
        for row in list(package_records):
            if row['kind'] != 'class':
                continue
            cls = targets[row['canonical']]
            for name in sorted(n for n in dir(cls) if not n.startswith('_')):
                value = inspect.getattr_static(cls, name)
                kind = 'staticmethod' if isinstance(value, staticmethod) else 'classmethod' if isinstance(value, classmethod) else 'property' if isinstance(value, property) else 'method' if callable(value) else 'data_or_descriptor'
                underlying = value.__func__ if isinstance(value, (staticmethod, classmethod)) else value.fget if isinstance(value, property) else value
                source = _registry_source(underlying, roots, sources)
                members.append({'id': row['id'] + '.' + name, 'package': package, 'version': version,
                    'kind': 'class-member', 'name': name, 'memberKind': kind, 'classObjectId': row['id'],
                    'source': source, 'upstreamDocumentation': _registry_documentation(underlying, source),
                    'signature': _registry_signature_observation(underlying, source, row['id'] + '.' + name, roots) if callable(underlying) else None,
                    'contracts': {'types': None, 'units': None, 'geometry': None, 'domain': None, 'dependencies': None},
                    'stages': _registry_stages(False), 'evidence': []})
            try:
                text = inspect.getsource(cls)
                tree = ast.parse(textwrap.dedent(text))
                attrs = sorted({node.attr for node in ast.walk(tree) if isinstance(node, ast.Attribute)
                                and isinstance(node.value, ast.Name) and node.value.id == 'self'
                                and isinstance(node.ctx, ast.Store) and not node.attr.startswith('_')})
            except (OSError, TypeError, SyntaxError, IndentationError):
                attrs = []
            instance_attributes.append({'classObjectId': row['id'], 'names': attrs,
                'qualification': 'Static self.attr assignments only; dynamic names, inherited initialization and actual instance availability require runtime cases.'})
        module_details, unavailable = [], catalog['unavailableModules']
        for name in catalog['publicSurface']['modules']:
            if name not in {item['module'] for item in unavailable}:
                module_details.append(_registry_module_details(name, roots, sources))
        records.extend(package_records + members)
        packages.append({'package': package, 'version': version, 'catalogPaths': len(targets),
            'duplicatePathsRemoved': catalog['publicSurface']['duplicatePathsRemoved'],
            'callableObjects': len(grouped),
            'baseObjectFamilies': sum(r['kind'] in ('function', 'class') and not r.get('baseObjectId') for r in package_records),
            'dataBindings': sum(r['kind'] == 'data' for r in package_records),
            'classObjects': sum(r['kind'] == 'class' for r in package_records),
            'staticClassMembers': len(members), 'instanceAttributeCandidates': instance_attributes,
            'modules': module_details,
            'unavailableModules': [_registry_unavailable_details(item, roots, sources) for item in unavailable],
            'scopeQualification': 'Available recursive public surface only; unavailable optional modules remain explicit scope blockers. Counts are not independent physical algorithms.'})
    records.sort(key=lambda r: r['id'])
    return {'schemaVersion': 1, 'packages': packages, 'sourceFiles': dict(sorted(sources.items())),
            'pathIndex': dict(sorted(path_index.items())), 'records': records,
            'summary': {'catalogPaths': len(path_index), 'records': len(records),
                        'kinds': dict(sorted(collections.Counter(r['kind'] for r in records).items())),
                        'globalNumericalCoveragePercent': None,
                        'qualification': 'Inventory is distinct from typed/domain/numerical/UI/offline acceptance.'}}
