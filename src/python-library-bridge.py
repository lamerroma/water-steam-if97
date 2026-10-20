"""JSON bridge to unmodified ht/fluids. User input is data, never Python source."""
import importlib
import importlib.metadata
import inspect
import json
import math
import numbers
import pkgutil
import re
import numpy as np

_library_catalogs = {}
_library_targets = {}
_library_objects = {}
_library_next_object = 0
_library_active_package = None

def _library_encode(value, depth=0):
    global _library_next_object
    if depth > 30:
        raise ValueError('Result nesting exceeds the JSON bridge limit.')
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, numbers.Integral):
        n = int(value)
        return n if abs(n) <= 9007199254740991 else {'kind': 'integer', 'decimal': str(n)}
    if isinstance(value, numbers.Real):
        n = float(value)
        return n if math.isfinite(n) else {'kind': 'nonfinite', 'value': str(n)}
    if isinstance(value, complex):
        return {'kind': 'complex', 'real': _library_encode(value.real), 'imag': _library_encode(value.imag)}
    if isinstance(value, np.ndarray):
        if value.size > 100000:
            raise ValueError('Array output exceeds 100000 elements; use a smaller calculation.')
        return _library_encode(value.tolist(), depth + 1)
    if isinstance(value, (list, tuple, set)):
        if len(value) > 100000:
            raise ValueError('Sequence output exceeds 100000 elements.')
        return [_library_encode(item, depth + 1) for item in value]
    if isinstance(value, dict):
        return {str(key): _library_encode(item, depth + 1) for key, item in value.items()}
    _library_next_object += 1
    handle = 'object-' + str(_library_next_object)
    _library_objects[handle] = (_library_active_package, value)
    return {'kind': 'object', 'handle': handle, 'class': type(value).__module__ + '.' + type(value).__name__,
            'members': [name for name in dir(value) if not name.startswith('_')]}

def _library_decode(value):
    if isinstance(value, list):
        return [_library_decode(item) for item in value]
    if isinstance(value, dict):
        if set(value) == {'$array'}:
            return np.asarray(_library_decode(value['$array']))
        if set(value) == {'$complex'}:
            return complex(*value['$complex'])
        if set(value) == {'$object'}:
            return _library_objects[value['$object']][1]
        if set(value) == {'$function'}:
            path = value['$function']
            package = path.split('.', 1)[0]
            if package not in ('ht', 'fluids'):
                raise ValueError('Function references must point to a public library target.')
            _library_catalog(package)
            target = _library_targets[package].get(path)
            if not callable(target):
                raise ValueError('Function reference is not callable.')
            return target
        return {key: _library_decode(item) for key, item in value.items()}
    return value

def _library_doc_units(doc):
    sections = {'Parameters': [], 'Returns': []}
    active = None
    lines = doc.splitlines()
    for index, line in enumerate(lines):
        if line in sections:
            active = line
            continue
        if active and line and not line.startswith(' ') and not set(line) <= {'-'}:
            if index + 1 < len(lines) and lines[index + 1].startswith('---'):
                active = None
                continue
            if ':' in line:
                sections[active].append({'name': line.split(':', 1)[0].strip(), 'unit': None})
        if active and sections[active]:
            match = re.search(r'\[([^\[\]]*)\]\s*$', line.strip())
            if match and match.group(1) and not match.group(1).isdigit():
                unit = match.group(1)
                sections[active][-1]['unit'] = '1' if unit in ('-', 'dimensionless') else unit
    return sections

def _library_describe(target, name):
    doc = inspect.getdoc(target) or ''
    parameters = []
    try:
        signature = inspect.signature(target)
        for item in signature.parameters.values():
            parameters.append({'name': item.name, 'kind': item.kind.name,
                               'required': item.default is inspect.Parameter.empty and item.kind not in (item.VAR_POSITIONAL, item.VAR_KEYWORD),
                               'default': None if item.default is inspect.Parameter.empty else repr(item.default)[:200]})
        signature = str(signature)
    except (TypeError, ValueError):
        signature = None
    return {'path': name, 'kind': 'class' if inspect.isclass(target) else 'function' if callable(target) else 'data',
            'signature': signature, 'parameters': parameters, 'summary': doc.split('\n\n', 1)[0][:500],
            'documentation': doc, 'documentedUnits': _library_doc_units(doc),
            'unitSource': 'Unmodified upstream docstring; not an independently verified unit schema.'}

def _library_catalog(package):
    if package in _library_catalogs:
        return _library_catalogs[package]
    root = importlib.import_module(package)
    names = [package] + [package + '.' + item.name for item in pkgutil.iter_modules(root.__path__) if not item.name.startswith('_')]
    entries, unavailable = [], []
    targets = {}
    for module_name in names:
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            unavailable.append({'module': module_name, 'reason': type(exc).__name__ + ': ' + str(exc)})
            continue
        public = getattr(module, '__all__', [name for name in vars(module) if not name.startswith('_')])
        for name in public:
            if name.startswith('_'):
                continue
            try:
                value = getattr(module, name)
            except Exception:
                continue
            if inspect.ismodule(value):
                continue
            path = module_name + '.' + name
            targets[path] = value
            info = _library_describe(value, path)
            info.pop('documentation')
            entries.append(info)
    _library_targets[package] = targets
    result = {'package': package, 'version': importlib.metadata.version(package),
              'entries': sorted(entries, key=lambda item: item['path']), 'unavailableModules': unavailable,
              'validation': 'Integration inventory only; numerical acceptance remains pending.'}
    _library_catalogs[package] = result
    return result

def _library_resolve(package, payload):
    if 'handle' in payload:
        stored = _library_objects.get(payload['handle'])
        if stored is None:
            raise KeyError('Object handle is stale; construct it again after cancellation or restart.')
        owner, obj = stored
        if owner != package:
            raise ValueError('Object belongs to another library; select its owning package.')
        name = payload.get('member', '')
        if not isinstance(name, str) or not name or name.startswith('_') or '.' in name:
            raise ValueError('Specify a public object member.')
        return getattr(obj, name), type(obj).__module__ + '.' + type(obj).__name__ + '.' + name
    _library_catalog(package)
    name = payload.get('target')
    if not isinstance(name, str) or name not in _library_targets[package]:
        raise ValueError('Select a public target from the installed library catalog.')
    return _library_targets[package][name], name

def _thermocalc_library_json(text):
    global _library_active_package
    try:
        request = json.loads(text)
        package, method, payload = request['module'], request['method'], request['payload']
        if package not in ('ht', 'fluids'):
            raise ValueError('Unsupported library.')
        _library_active_package = package
        if package == 'fluids' and method == 'pipe-hydraulics':
            return json.dumps({'ok': True, 'result': _thermocalc_pipe(payload)}, allow_nan=False)
        if method == 'catalog':
            return json.dumps({'ok': True, 'result': _library_catalog(package)}, allow_nan=False)
        if method == 'release':
            removed = _library_objects.pop(payload.get('handle'), None) is not None
            return json.dumps({'ok': True, 'result': {'released': removed}})
        target, name = _library_resolve(package, payload)
        description = _library_describe(target, name)
        if method == 'describe':
            return json.dumps({'ok': True, 'result': description}, allow_nan=False)
        if method == 'call':
            if not callable(target):
                raise TypeError('Selected target is data, not a callable.')
            args, kwargs = payload.get('args', []), payload.get('kwargs', {})
            if not isinstance(args, list) or not isinstance(kwargs, dict):
                raise TypeError('args must be an array and kwargs must be an object.')
            value = target(*_library_decode(args), **_library_decode(kwargs))
        elif method == 'get':
            if callable(target):
                raise TypeError('Use call for a callable target.')
            value = target
        else:
            raise ValueError('Unsupported library operation.')
        return json.dumps({'ok': True, 'result': _library_encode(value), 'description': description}, allow_nan=False)
    except Exception as exc:
        return json.dumps({'ok': False, 'code': 'library-error', 'message': type(exc).__name__ + ': ' + str(exc)})
