"use strict";
const CALCULATION_IMPLEMENTATION_REVISION = "ff7469b62d28054646c4567f4955a541ac3e5217922b712ed0f08a78339501aa";
const PYTHON_PACKAGE = {"revision":"71ea1664738eb516","base":"assets/python/71ea1664738eb516/","pyodide":"314.0.7","python":"3.14.2","packages":{"numpy":{"version":"2.4.6","file":"pyodide/numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl"},"scipy":{"version":"1.18.0","file":"pyodide/scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl"},"ht":{"version":"1.2.0","file":"wheels/ht-1.2.0-py3-none-any.whl"},"fluids":{"version":"1.3.1","file":"wheels/fluids-1.3.1-py3-none-any.whl"}},"files":[{"url":"assets/python/71ea1664738eb516/licenses/cpython-LICENSE.txt","sha256":"b0e25a78cffb43f4d92de8b61ccfa1f1f98ecbc22330b54b5251e7b6ba010231","bytes":13804},{"url":"assets/python/71ea1664738eb516/licenses/emscripten-LICENSE.txt","sha256":"620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86","bytes":5093},{"url":"assets/python/71ea1664738eb516/licenses/fluids-LICENSE.txt","sha256":"89e1ac506f4cae373e1f5c20700c73d69892cef189f6de8dd26301acaa0710aa","bytes":1090},{"url":"assets/python/71ea1664738eb516/licenses/ht-LICENSE.txt","sha256":"0066a88479661eb03701a3e1f9c32be428779a5f4ad7b6bbed7d6bc1fa36f7c4","bytes":1085},{"url":"assets/python/71ea1664738eb516/licenses/pyodide-LICENSE.txt","sha256":"1f256ecad192880510e84ad60474eab7589218784b9a50bc7ceee34c2b91f1d5","bytes":16725},{"url":"assets/python/71ea1664738eb516/pyodide/numpy-2.4.6-cp314-cp314-pyemscripten_2026_0_wasm32.whl","sha256":"a292c1f5d7d8a2208cd5e94fc467604c131cabcd2fc14fed6eefde121e7fabdf","bytes":2960568},{"url":"assets/python/71ea1664738eb516/pyodide/pyodide-lock.json","sha256":"5dc2fc119108bc148c7457dc86e7675b5c87e1cafd420b9c34c1eaef7b36c010","bytes":119077},{"url":"assets/python/71ea1664738eb516/pyodide/pyodide.asm.mjs","sha256":"f7cdc8ece80678ceb712f8e65ebe6d3a83203a180c399865f49612a051693635","bytes":1250344},{"url":"assets/python/71ea1664738eb516/pyodide/pyodide.asm.wasm","sha256":"cc36e3cab04fdfc9a63ff13eb52eae2b911bf46c025cc7b281f394bd3de1d5e6","bytes":9598218},{"url":"assets/python/71ea1664738eb516/pyodide/pyodide.mjs","sha256":"6f1d60f7bf529beb300f0f47983c921d3982363640ba20af0e38efdddbc66109","bytes":17931},{"url":"assets/python/71ea1664738eb516/pyodide/python_stdlib.zip","sha256":"fa1957e5777068fc4f7437f96d860ae2fbe9c19732ba06c84e004ec16dd7dd7a","bytes":2545637},{"url":"assets/python/71ea1664738eb516/pyodide/scipy-1.18.0-cp314-cp314-pyemscripten_2026_0_wasm32.whl","sha256":"17ee329a957863516d1bb6a6aaa0c60576fac027e9cd3d43de27f58b5b599b50","bytes":14029750},{"url":"assets/python/71ea1664738eb516/wheels/fluids-1.3.1-py3-none-any.whl","sha256":"d9097efe57c910ac14b89a1984d5e7062ee9df1afc84e089d944fdd85404e361","bytes":608795},{"url":"assets/python/71ea1664738eb516/wheels/ht-1.2.0-py3-none-any.whl","sha256":"a4716bc3c8a9ef5e3dfff68d552232ba6f05c0edd3caa07fb72bee2306975ace","bytes":805152}],"bytes":31973269};
const PYTHON_BRIDGE_SOURCE = "\"\"\"JSON bridge to unmodified ht/fluids. User input is data, never Python source.\"\"\"\nimport importlib\nimport importlib.metadata\nimport inspect\nimport json\nimport math\nimport numbers\nimport pkgutil\nimport re\nimport sys\nimport datetime\nimport uuid\nimport numpy as np\n\n_library_catalogs = {}\n_library_targets = {}\n_library_objects = {}\n_library_next_object = 0\n_library_active_package = None\n_library_session = uuid.uuid4().hex\n\n\ndef _library_object(handle, owner=None):\n    stored = _library_objects.get(handle) if isinstance(handle, str) else None\n    if stored is None:\n        raise KeyError('Object handle is stale; construct it again after cancellation or restart.')\n    if owner is not None and stored[0] != owner:\n        raise ValueError('Object belongs to another library; select its owning package.')\n    return stored[1]\n\n\ndef _library_datetime(value):\n    if set(value) not in ({'$datetime'}, {'$datetime', '$naive'}):\n        raise ValueError('Datetime accepts only $datetime and an explicit $naive: true flag.')\n    text = value['$datetime']\n    if not isinstance(text, str) or not re.fullmatch(\n            r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)?', text):\n        raise ValueError('Datetime requires an ISO date/time with seconds and at most six fractional digits.')\n    if text.endswith('-00:00'):\n        raise ValueError('Unknown UTC offset -00:00 is unsupported; specify a known offset or explicit naive time.')\n    moment = datetime.datetime.fromisoformat(text.replace('Z', '+00:00'))\n    naive = '$naive' in value\n    if naive and value['$naive'] is not True:\n        raise ValueError('$naive must be true when present.')\n    if naive != (moment.tzinfo is None):\n        raise ValueError('Specify a UTC offset or Z; a time without offset requires $naive: true.')\n    return moment\n\n# Pinned upstream behavior, observed independently in CPython and Pyodide.\n# Preserve the raw API and report discrepancies rather than relabeling them valid.\n_library_known_issues = {\n    'fluids.atmosphere.sunrise_sunset': [{\n        'code': 'fluids-sunrise-fixed-offset', 'scope': 'Timezone-aware datetime with Python datetime.timezone, including UTC.',\n        'message': 'fluids 1.3.1 sunrise_sunset raises ValueError: fromutc: dt.tzinfo is not self for fixed-offset aware datetime. An explicitly naive datetime follows a separate upstream UTC convention; it is not substituted automatically.'}],\n    'fluids.numerics.arrays.det': [{\n        'code': 'fluids-det-rank2-1x1', 'scope': 'Rank-2 one-by-one input, for example [[7]].',\n        'message': 'fluids 1.3.1 det([[7]]) returns [7], rather than the scalar determinant 7. This input shape is not numerically accepted.'}],\n    'ht.core.LMTD': [{\n        'code': 'ht-lmtd-nearly-equal', 'scope': 'Nearly equal positive terminal temperature differences.',\n        'message': 'ht 1.2.0 LMTD can lose precision for nearly equal temperature differences. A recorded 100/99.999999999/30/30.000000002 counterflow case differs from a high-precision log-mean by about 0.000404124 K.'}]\n}\n\ndef _library_encode(value, depth=0):\n    global _library_next_object\n    if depth > 30:\n        raise ValueError('Result nesting exceeds the JSON bridge limit.')\n    if value is None or isinstance(value, (str, bool)):\n        return value\n    if isinstance(value, datetime.datetime):\n        return {'kind': 'datetime', 'iso8601': value.isoformat(),\n                'timezone': 'naive' if value.utcoffset() is None else 'fixed-offset'}\n    if isinstance(value, numbers.Integral):\n        n = int(value)\n        return n if abs(n) <= 9007199254740991 else {'kind': 'integer', 'decimal': str(n)}\n    if isinstance(value, numbers.Real):\n        n = float(value)\n        return n if math.isfinite(n) else {'kind': 'nonfinite', 'value': str(n)}\n    if isinstance(value, complex):\n        return {'kind': 'complex', 'real': _library_encode(value.real), 'imag': _library_encode(value.imag)}\n    if isinstance(value, np.ndarray):\n        if value.size > 100000:\n            raise ValueError('Array output exceeds 100000 elements; use a smaller calculation.')\n        return _library_encode(value.tolist(), depth + 1)\n    if isinstance(value, (list, tuple, set)):\n        if len(value) > 100000:\n            raise ValueError('Sequence output exceeds 100000 elements.')\n        return [_library_encode(item, depth + 1) for item in value]\n    if isinstance(value, dict):\n        return {str(key): _library_encode(item, depth + 1) for key, item in value.items()}\n    _library_next_object += 1\n    handle = 'object-' + _library_session + '-' + str(_library_next_object)\n    _library_objects[handle] = (_library_active_package, value)\n    return {'kind': 'object', 'handle': handle, 'scope': 'worker-session',\n            'class': type(value).__module__ + '.' + type(value).__name__,\n            'members': [name for name in dir(value) if not name.startswith('_')]}\n\ndef _library_decode(value):\n    if isinstance(value, list):\n        return [_library_decode(item) for item in value]\n    if isinstance(value, dict):\n        if '$datetime' in value:\n            return _library_datetime(value)\n        if set(value) == {'$array'}:\n            return np.asarray(_library_decode(value['$array']))\n        if set(value) == {'$complex'}:\n            return complex(*value['$complex'])\n        if set(value) == {'$object'}:\n            return _library_object(value['$object'])\n        if set(value) == {'$function'}:\n            path = value['$function']\n            package = path.split('.', 1)[0]\n            if package not in ('ht', 'fluids'):\n                raise ValueError('Function references must point to a public library target.')\n            _library_catalog(package)\n            target = _library_targets[package].get(path)\n            if not callable(target):\n                raise ValueError('Function reference is not callable.')\n            return target\n        return {key: _library_decode(item) for key, item in value.items()}\n    return value\n\ndef _library_doc_units(doc):\n    sections = {'Parameters': [], 'Returns': []}\n    active = None\n    lines = doc.splitlines()\n    for index, line in enumerate(lines):\n        if line in sections:\n            active = line\n            continue\n        if active and line and not line.startswith(' ') and not set(line) <= {'-'}:\n            if index + 1 < len(lines) and lines[index + 1].startswith('---'):\n                active = None\n                continue\n            if ':' in line:\n                sections[active].append({'name': line.split(':', 1)[0].strip(), 'unit': None})\n        if active and sections[active]:\n            match = re.search(r'\\[([^\\[\\]]*)\\]\\s*$', line.strip())\n            if match and match.group(1) and not match.group(1).isdigit():\n                unit = match.group(1)\n                sections[active][-1]['unit'] = '1' if unit in ('-', 'dimensionless') else unit\n    return sections\n\ndef _library_describe(target, name):\n    doc = inspect.getdoc(target) or ''\n    parameters = []\n    try:\n        signature = inspect.signature(target)\n        for item in signature.parameters.values():\n            parameters.append({'name': item.name, 'kind': item.kind.name,\n                               'required': item.default is inspect.Parameter.empty and item.kind not in (item.VAR_POSITIONAL, item.VAR_KEYWORD),\n                               'default': None if item.default is inspect.Parameter.empty else repr(item.default)[:200]})\n        signature = str(signature)\n    except (TypeError, ValueError):\n        signature = None\n    source_target = target.pyfunc if isinstance(target, np.vectorize) else target\n    definition = getattr(source_target, '__module__', '') + '.' + getattr(source_target, '__qualname__', '')\n    return {'path': name, 'kind': 'class' if inspect.isclass(target) else 'function' if callable(target) else 'data',\n            'signature': signature, 'parameters': parameters, 'summary': doc.split('\\n\\n', 1)[0][:500],\n            'documentation': doc, 'documentedUnits': _library_doc_units(doc),\n            'unitSource': 'Unmodified upstream docstring; not an independently verified unit schema.',\n            'knownIssues': _library_known_issues.get(definition, [])}\n\ndef _library_catalog(package):\n    if package in _library_catalogs:\n        return _library_catalogs[package]\n    root = importlib.import_module(package)\n    unavailable = {}\n\n    def discovery_error(name):\n        error = sys.exc_info()[1]\n        unavailable[name] = {'module': name, 'reason': type(error).__name__ + ': ' + str(error)}\n\n    names = [package] + [item.name for item in pkgutil.walk_packages(\n        root.__path__, package + '.', onerror=discovery_error)\n        if not any(part.startswith('_') for part in item.name.split('.'))]\n    entries = {}\n    targets = {}\n    duplicates = 0\n    for module_name in sorted(set(names)):\n        try:\n            module = importlib.import_module(module_name)\n        except Exception as exc:\n            unavailable[module_name] = {'module': module_name, 'reason': type(exc).__name__ + ': ' + str(exc)}\n            continue\n        public = getattr(module, '__all__', [name for name in vars(module) if not name.startswith('_')])\n        for name in public:\n            if name.startswith('_'):\n                continue\n            try:\n                value = getattr(module, name)\n            except Exception:\n                continue\n            if inspect.ismodule(value):\n                continue\n            path = module_name + '.' + name\n            if path in targets:\n                duplicates += 1\n                continue\n            targets[path] = value\n            info = _library_describe(value, path)\n            info.pop('documentation')\n            entries[path] = info\n    _library_targets[package] = targets\n    result = {'package': package, 'version': importlib.metadata.version(package),\n              'entries': [entries[name] for name in sorted(entries)],\n              'unavailableModules': [unavailable[name] for name in sorted(unavailable)],\n              'publicSurface': {'discovery': 'recursive', 'modules': sorted(set(names)),\n                                'duplicatePathsRemoved': duplicates},\n              'validation': 'Integration inventory only; numerical acceptance remains pending.'}\n    _library_catalogs[package] = result\n    return result\n\ndef _library_resolve(package, payload):\n    if 'handle' in payload:\n        obj = _library_object(payload['handle'], package)\n        name = payload.get('member', '')\n        if not isinstance(name, str) or not name or name.startswith('_') or '.' in name:\n            raise ValueError('Specify a public object member.')\n        return getattr(obj, name), type(obj).__module__ + '.' + type(obj).__name__ + '.' + name\n    _library_catalog(package)\n    name = payload.get('target')\n    if not isinstance(name, str) or name not in _library_targets[package]:\n        raise ValueError('Select a public target from the installed library catalog.')\n    return _library_targets[package][name], name\n\ndef _thermocalc_library_json(text):\n    global _library_active_package\n    description = None\n    try:\n        request = json.loads(text)\n        package, method, payload = request['module'], request['method'], request['payload']\n        if package not in ('ht', 'fluids'):\n            raise ValueError('Unsupported library.')\n        _library_active_package = package\n        if package == 'fluids' and method == 'pipe-hydraulics':\n            return json.dumps({'ok': True, 'result': _thermocalc_pipe(payload)}, allow_nan=False)\n        if method == 'catalog':\n            return json.dumps({'ok': True, 'result': _library_catalog(package)}, allow_nan=False)\n        if method == 'release':\n            handle = payload.get('handle')\n            if not isinstance(handle, str):\n                raise ValueError('Specify an object handle string.')\n            if handle in _library_objects:\n                _library_object(handle, package)\n            removed = _library_objects.pop(handle, None) is not None\n            return json.dumps({'ok': True, 'result': {'released': removed}})\n        target, name = _library_resolve(package, payload)\n        description = _library_describe(target, name)\n        if method == 'describe':\n            return json.dumps({'ok': True, 'result': description}, allow_nan=False)\n        if method == 'call':\n            if not callable(target):\n                raise TypeError('Selected target is data, not a callable.')\n            args, kwargs = payload.get('args', []), payload.get('kwargs', {})\n            if not isinstance(args, list) or not isinstance(kwargs, dict):\n                raise TypeError('args must be an array and kwargs must be an object.')\n            value = target(*_library_decode(args), **_library_decode(kwargs))\n        elif method == 'get':\n            if callable(target):\n                raise TypeError('Use call for a callable target.')\n            value = target\n        else:\n            raise ValueError('Unsupported library operation.')\n        return json.dumps({'ok': True, 'result': _library_encode(value), 'description': description}, allow_nan=False)\n    except Exception as exc:\n        return json.dumps({'ok': False, 'code': 'library-error', 'message': type(exc).__name__ + ': ' + str(exc),\n                           **({'description': description} if description is not None else {})})\n\n\"\"\"Fixed SI workflow; public fluids functions, explicit application domain policy.\"\"\"\nimport math\nimport importlib.metadata\nimport fluids\n\ndef _thermocalc_pipe(payload):\n    defaults = {'length': 0, 'roughness': 0, 'localK': 0, 'efficiency': .75,\n                'heightDifference': 0, 'pressureDifference': 0}\n    required = ('rho', 'mu', 'velocity', 'diameter')\n    allowed = set(required) | set(defaults) | {'frictionMethod'}\n    if set(payload) - allowed:\n        raise ValueError('Unknown pipe input field.')\n    p = {**defaults, **payload}\n    for key in (*required, *defaults):\n        value = p.get(key)\n        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):\n            raise ValueError('Finite numeric SI input required: ' + key)\n    if any(p[k] <= 0 for k in ('rho', 'mu', 'diameter')):\n        raise ValueError('Density, viscosity and inner diameter must be positive.')\n    if any(p[k] < 0 for k in ('velocity', 'length', 'roughness', 'localK')):\n        raise ValueError('Velocity, length, roughness and local K must be nonnegative.')\n    if not 0 < p['efficiency'] <= 1 or p['roughness']/p['diameter'] > .05:\n        raise ValueError('Require 0 < efficiency <= 1 and 0 <= roughness/D <= 0.05.')\n    requested = p.get('frictionMethod', 'Clamond')\n    if requested not in ('Clamond', 'Colebrook'):\n        raise ValueError('Friction method must be Clamond or Colebrook.')\n    rho, mu, V, D = (p[k] for k in required)\n    area, nu = math.pi*D*D/4, mu/rho\n    if area <= 0 or nu <= 0:\n        raise ValueError('Derived area or viscosity underflows.')\n    volume = area*V\n    mass = rho*volume\n    Re = fluids.Reynolds(V=V, D=D, rho=rho, mu=mu)\n    if not math.isfinite(Re) or Re < 0 or V > 0 and Re == 0:\n        raise ValueError('Derived Reynolds number is invalid.')\n    if V == 0:\n        factor, method = None, 'zero'\n    elif Re < 2300:\n        # fluids.friction_factor switches at 2040; the application's explicit\n        # 2300/4000 policy must not be replaced by that upstream default.\n        factor, method = fluids.friction_laminar(Re), 'laminar'\n    elif Re < 4000:\n        factor, method = None, 'transition'\n    else:\n        factor = fluids.friction_factor(Re=Re, eD=p['roughness']/D, Method=requested, Darcy=True)\n        method = requested.lower()\n    dynamic = fluids.dP_from_K(K=1, rho=rho, V=V)\n    local = fluids.dP_from_K(K=p['localK'], rho=rho, V=V)\n    friction = 0 if V == 0 or p['length'] == 0 else None if factor is None else fluids.dP_from_K(K=factor*p['length']/D, rho=rho, V=V)\n    loss = None if friction is None else friction+local\n    g = 9.80665\n    head = None if loss is None else loss/(rho*g)\n    required_head = None if head is None else head+p['heightDifference']+p['pressureDifference']/(rho*g)\n    pump = None if required_head is None else max(0, required_head)\n    hydraulic = None if pump is None else rho*g*volume*pump\n    result = {**p, 'area': area, 'mu': mu, 'nu': nu, 'mass': mass, 'volume': volume,\n              'velocity': V, 'Re': Re, 'dynamicPressure': dynamic, 'factor': factor,\n              'fanningFactor': None if factor is None else factor/4,\n              'frictionPressure': friction, 'localPressure': local, 'lossPressure': loss,\n              'lossHead': head, 'requiredHead': required_head, 'pumpHead': pump,\n              'hydraulicPower': hydraulic, 'shaftPower': None if hydraulic is None else hydraulic/p['efficiency'],\n              'frictionMethod': requested, 'method': method, 'backend': 'fluids', 'engineVersion': importlib.metadata.version('fluids'),\n              'policy': 'incompressible-round-pipe-2300-4000-v1'}\n    if any(isinstance(v, (int, float)) and not math.isfinite(v) for v in result.values()):\n        raise ValueError('Pipe calculation overflow.')\n    return result\n";

function parseNumber(text) {
  const value=String(text).trim().replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))throw Error('Введіть число без розділювачів тисяч. Десяткова кома або крапка дозволені.');
  const n=Number(value);if(!Number.isFinite(n))throw Error('Число має бути скінченним.');return n;
}
const pressureFactors={MPa:1,kPa:0.001,Pa:1e-6,bar:0.1,atm:0.101325,psi:.45359237*9.80665/(.3048/12)**2/1e6};
function toCanonical(value,unit) {
  if(unit in pressureFactors)return value*pressureFactors[unit];
  if(unit==='F')return (value-32)/1.8+273.15;
  if(unit==='m3kg')return value;if(unit==='ft3lb')return value/16.01846337396014;
  if(unit==='lbft3')return value*16.01846337396014;
  if(unit==='Btulb')return value*2.326;
  if(unit==='BtulbR')return value*4.1868;
  if(unit==='C')return value+273.15;
  if(unit==='kgm3'||unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value/1000;
  if(unit==='fraction')return value;if(unit==='percent')return value/100;
  throw Error('Невідома одиниця.');
}
function fromCanonical(value,unit) {
  if(unit in pressureFactors)return value/pressureFactors[unit];
  if(unit==='F')return (value-273.15)*1.8+32;
  if(unit==='m3kg')return value;if(unit==='ft3lb')return value*16.01846337396014;
  if(unit==='lbft3')return value/16.01846337396014;
  if(unit==='Btulb')return value/2.326;
  if(unit==='BtulbR')return value/4.1868;
  if(unit==='C')return value-273.15;
  if(unit==='kgm3'||unit==='K'||unit==='kJkg'||unit==='kJkgK')return value;
  if(unit==='Jkg'||unit==='JkgK')return value*1000;
  if(unit==='fraction')return value;if(unit==='percent')return value*100;
  throw Error('Невідома одиниця.');
}
// International pound/foot, standard gravity and International Table Btu (NIST SP811).
const LB=.45359237,FT=.3048,BTU=1055.05585262,PSI=LB*9.80665/(FT/12)**2;
function englishProperty(key,value,unit=''){
 const e=1000*LB/BTU,v=LB/FT**3,p=1e6/PSI;
 const map={p:[p,'psi'],consumption:[1/LB,'lb/(kW·h)'],dT:[1.8,'°F'],T:[1.8,'°F'],rho:[FT**3/LB,'lb/ft³'],v:[v,'ft³/lb'],h:[e,'Btu/lb'],u:[e,'Btu/lb'],A:[e,'Btu/lb'],G:[e,'Btu/lb'],ex:[e,'Btu/lb'],s:[e/1.8,'Btu/(lb·°R)'],cp:[e/1.8,'Btu/(lb·°R)'],cv:[e/1.8,'Btu/(lb·°R)'],w:[1/FT,'ft/s'],alpha:[1/1.8,'1/°R'],kappa:[1/p,'1/psi'],dvdt:[v/1.8,'ft³/(lb·°R)'],dvdp:[v/p,'ft³/(lb·psi)'],dpdt:[p/1.8,'psi/°R'],dpdv:[p/v,'psi·lb/ft³'],jt:[1.8/p,'°R/psi'],ijt:[e/p,'Btu/(lb·psi)'],mu:[FT/LB,'lb/(ft·s)'],nu:[1/FT**2,'ft²/s'],diffusivity:[1/FT**2,'ft²/s'],lambda:[3600*FT/(BTU*1.8),'Btu/(h·ft·°R)'],sigma:[FT/(LB*9.80665),'lbf/ft'],flow:[1/LB,'lb/s'],power:[3600000/BTU,'Btu/h'],work:[e,'Btu/lb']};
 const spec=map[key];if(!spec)return [value,unit];return [value==null?null:key==='T'?(value-273.15)*1.8+32:value*spec[0],spec[1]];
}



// Public adapter protocol. Adapter versions describe this interface, not upstream library releases.
const CALCULATION_PROTOCOL_VERSION=1;
// The bundler fingerprints Worker sources and its WASM. Direct source imports
// use null; shipped UI and Worker always carry the same exact revision.
function calculationImplementationRevision(){return typeof CALCULATION_IMPLEMENTATION_REVISION==='string'?CALCULATION_IMPLEMENTATION_REVISION:null;}
const calculationWaterPairs={pt:['p','T'],ph:['p','h'],ps:['p','s'],pv:['p','v'],pu:['p','u'],th:['T','h'],ts:['T','s'],tv:['T','v'],tu:['T','u'],hs:['h','s'],us:['u','s'],vs:['v','s'],hv:['h','v'],uv:['u','v'],satp:['p'],satt:['T'],px:['p','x'],tx:['T','x'],prho:['p','rho'],trho:['T','rho']};
const calculationUnitGroups={
 p:{canonical:'MPa',accepted:['MPa','kPa','Pa','bar','atm','psi']},
 T:{canonical:'K',accepted:['K','C','F']},
 h:{canonical:'kJkg',accepted:['kJkg','Jkg','Btulb']},
 s:{canonical:'kJkgK',accepted:['kJkgK','JkgK','BtulbR']},
 v:{canonical:'m3kg',accepted:['m3kg','ft3lb']},
 rho:{canonical:'kgm3',accepted:['kgm3','lbft3']},
 x:{canonical:'fraction',accepted:['fraction','percent']}
};
calculationUnitGroups.u=calculationUnitGroups.h;
const calculationOutputUnits={p:'MPa',T:'K',rho:'kg/m3',v:'m3/kg',h:'kJ/kg',u:'kJ/kg',A:'kJ/kg',G:'kJ/kg',s:'kJ/(kg K)',cp:'kJ/(kg K)',cv:'kJ/(kg K)',w:'m/s',x:'1',Z:'1',gamma:'1',caloricRatio:'1',isentropic:'1',mu:'Pa s',lambda:'W/(m K)',nu:'m2/s',diffusivity:'m2/s',Pr:'1',sigma:'N/m',dc:'1',alpha:'1/K',kappa:'1/MPa',dvdt:'m3/(kg K)',dvdp:'m3/(kg MPa)',dpdt:'MPa/K',dpdv:'MPa kg/m3',jt:'K/MPa',ijt:'kJ/(kg MPa)',latentHeat:'kJ/kg',M:'kg/kmol',R:'kJ/(kg K)',mixingEntropy:'kJ/(kg K)',excessAirLambda:'1',dissociationDeltaH:'kJ/kg',dissociationDeltaS:'kJ/(kg K)',dissociationDeltaCp:'kJ/(kg K)'};
function calculationFreeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))calculationFreeze(item);Object.freeze(value);}return value;}
const CALCULATION_MODULES=calculationFreeze([
 {id:'water',engineVersion:'1.0.0',runtime:'javascript-wasm',methods:['calculate'],models:['IF97','IAPWS-95'],resultFormat:'water-state',
  inputSchemas:{calculate:{selector:'mode',cases:Object.fromEntries(Object.entries(calculationWaterPairs).map(([mode,pair])=>[mode,Object.fromEntries(pair.map((quantity,i)=>[i===0?'a':'b',quantity]))]))}},
  validity:{authority:'Existing engine domain checks are authoritative; ranges are not rectangular guarantees.',models:{
   IF97:{temperature:{unit:'K',min:273.15,max:2273.15},pressure:{unit:'MPa',minExclusive:0,max:100},conditions:['Above 1073.15 K: pressure <= 50 MPa.','Saturation and inverse input pairs have their own domains.']},
   'IAPWS-95':{temperature:{unit:'K',min:251.165,max:1273},pressure:{unit:'MPa',minExclusive:0,max:1000},conditions:['Stable fluid above the implemented melting boundary.','Exact critical point excluded; transport properties have separate limits.']}}}},
 {id:'water-heos',engineVersion:'1.2.0',upstreamVersion:'8.0.0',runtime:'wasm',methods:['calculate'],models:['HEOS::Water'],resultFormat:'water-state',
  inputSchemas:{calculate:{selector:'mode',cases:Object.fromEntries(Object.entries(calculationWaterPairs).map(([mode,pair])=>[mode,Object.fromEntries(pair.map((quantity,i)=>[i===0?'a':'b',quantity]))]))}},
  validity:{experimental:true,upstream:{library:'CoolProp',version:'8.0.0'},authority:'CoolProp HEOS::Water with explicit IAPWS fluid and transport limits.',reference:'Default CoolProp IAPWS-95 h/s reference; no user reference offsets.',steam97WebParityVerified:false,
   temperature:{unit:'K',min:251.165,max:1273},pressure:{unit:'MPa',minExclusive:0,max:1000},conditions:['Stable fluid above melting only.','Saturation: 273.16 <= T < 647.096 K. Exact critical point excluded.','P-T coexistence band: max(1e-12 MPa, 1e-6 relative pressure); quality is not inferred.','Two-phase heat capacities, sound, derivatives and transport are unavailable.','All 20 input modes; extended inversions search bounded stable branches. Existing water and workflow models are unchanged.']}},
 {id:'gas-tables',engineVersion:'1.0.0',runtime:'javascript',methods:['calculate'],models:['BSW2003-technical','BSW2003-VDI4670-caloric-experimental'],resultFormat:'gas-state',
  inputSchemas:{calculate:{selector:'mode',cases:{pt:{p:'p',value:'T',fractions:'x'},ph:{p:'p',value:'h',fractions:'x'},ps:{p:'p',value:'s',fractions:'x'}}}},
  validity:{authority:'Existing BSW2003 and VDI4670 domain checks are authoritative.',temperature:{unit:'K',min:200,max:3300},pressure:{unit:'MPa',minExclusive:0},
   dissociation:{experimental:true,temperature:{unit:'K',min:1200,max:2000},pressure:{unit:'MPa',min:.01,max:5},conditions:['Complete combustion in ordinary air; explicit lambda > 1.05.','Initial mole fractions: N2 > 0, O2 >= 0.01, CO = 0.'],unavailableOutputs:['w','isentropic'],composition:'initial-frozen',equilibriumCompositionComputed:false},steam97WebParityVerified:false}},
 {id:'workflows',engineVersion:'1.0.0',runtime:'javascript-wasm',methods:['project','rankine-sweep','study-report-html','water-process','steam-process','engineering','diagram-base','diagram-isotherm','diagram-refine','custom-cycle','library-cycle','cycle-comparison','cycle-preset','batch'],resultFormat:'native',
  validity:{authority:'Each existing workflow validates its own input and physical model.',units:'Native method-specific schemas are preserved; no generic numeric-unit inference.'}},
 ...[['ht','1.2.0'],['fluids','1.3.1']].map(([id,engineVersion])=>({id,engineVersion,runtime:'pyodide',methods:['catalog','describe','call','get','release',...(id==='fluids'?['pipe-hydraulics']:[])],resultFormat:'python-json',
  validity:{authority:'Pinned, unmodified upstream package. Consult the selected function documentation and its correlation domain.',units:'Upstream documented units; no automatic conversion.',numericalAcceptance:'pending',optionalDependencies:'Numba, Pint, plotting and other extras are not bundled.'}}))
]);
class CalculationModuleError extends Error{
 constructor(code,message,details={}){super(message);this.name='CalculationModuleError';this.code=code;this.details=details;}
}
function calculationModuleDescriptor(moduleId){
 const descriptor=CALCULATION_MODULES.find(module=>module.id===moduleId);
 if(!descriptor)throw new CalculationModuleError('unsupported-module','Unknown calculation module.',{moduleId});
 return descriptor;
}
function calculationInputSchema(moduleId,methodId,payload){
 const schemas=calculationModuleDescriptor(moduleId).inputSchemas;
 const schema=schemas&&Object.hasOwn(schemas,methodId)?schemas[methodId]:null;
 if(!schema)return {};
 if(!schema.selector)return schema.fields??{};
 const value=payload?.[schema.selector];
 if(typeof value!=='string'||!Object.hasOwn(schema.cases,value))throw new CalculationModuleError('unsupported-method','Unknown calculation input pair.',{field:schema.selector,value});
 return schema.cases[value];
}
function createCalculationRequest({id,moduleId,methodId,payload,engineVersion,inputUnits}){
 const descriptor=calculationModuleDescriptor(moduleId);
 const schema=calculationInputSchema(moduleId,methodId,payload);
 return {protocolVersion:CALCULATION_PROTOCOL_VERSION,id,moduleId,engineVersion:engineVersion??descriptor.engineVersion,implementationRevision:calculationImplementationRevision(),methodId,payload,
  inputUnits:inputUnits??Object.fromEntries(Object.entries(schema).map(([field,quantity])=>[field,calculationUnitGroups[quantity].canonical]))};
}
function createLegacyCalculationRequest(id,type,payload){
 const moduleId=type==='calculate'?(payload.model==='HEOS::Water'?'water-heos':'water'):type==='gas-bsw2003'?'gas-tables':'workflows';
 return {...createCalculationRequest({id,moduleId,methodId:moduleId==='workflows'?type:'calculate',payload}),type};
}
function calculationObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function normalizeCalculationRequest(request){
 if(!calculationObject(request)||request.protocolVersion!==CALCULATION_PROTOCOL_VERSION)throw new CalculationModuleError('protocol','Unsupported calculation protocol.');
 if(!Number.isSafeInteger(request.id)||request.id<1)throw new CalculationModuleError('protocol','Invalid calculation request id.');
 const descriptor=calculationModuleDescriptor(request.moduleId);
 if(request.engineVersion!==descriptor.engineVersion)throw new CalculationModuleError('version-mismatch','Calculation adapter version does not match.',{expected:descriptor.engineVersion,received:request.engineVersion});
 const revision=calculationImplementationRevision();
 if(revision!==null&&request.implementationRevision!==revision)throw new CalculationModuleError('version-mismatch','Calculation implementation revision does not match.',{expected:revision,received:request.implementationRevision});
 if(!descriptor.methods.includes(request.methodId))throw new CalculationModuleError('unsupported-method','Unknown module method.',{methodId:request.methodId});
 if(!calculationObject(request.payload))throw new CalculationModuleError('invalid-input','Calculation arguments must be an object.');
 if(!calculationObject(request.inputUnits))throw new CalculationModuleError('invalid-units','Explicit input units are required.');
 if(request.moduleId!=='workflows'&&request.payload.pressureBasis!==undefined&&request.payload.pressureBasis!=='absolute')throw new CalculationModuleError('invalid-input','Module pressure must be absolute.',{field:'pressureBasis'});
 const schema=calculationInputSchema(request.moduleId,request.methodId,request.payload),payload={...request.payload},canonicalUnits={};
 if(Object.keys(request.inputUnits).some(field=>!Object.hasOwn(schema,field)))throw new CalculationModuleError('invalid-units','Unknown input unit field.');
 for(const [field,quantity] of Object.entries(schema)){
  const spec=calculationUnitGroups[quantity],unit=request.inputUnits[field];
  if(!spec.accepted.includes(unit))throw new CalculationModuleError('invalid-units','Unit does not match the input quantity.',{field,unit,accepted:[...spec.accepted]});
  canonicalUnits[field]=spec.canonical;
  const convert=value=>{if(!Number.isFinite(value))throw new CalculationModuleError('invalid-input','A finite numeric argument is required.',{field});const out=toCanonical(value,unit);if(!Number.isFinite(out))throw new CalculationModuleError('invalid-input','Input unit conversion overflow.',{field});return out;};
  if(field==='fractions'){
   if(!calculationObject(payload.fractions))throw new CalculationModuleError('invalid-input','Gas composition must be an object.',{field});
   payload.fractions=Object.fromEntries(Object.entries(payload.fractions).map(([species,value])=>[species,convert(value)]));
  }else payload[field]=convert(payload[field]);
 }
 if(request.moduleId==='water'&&!['IF97','IAPWS-95'].includes(payload.model??'IF97'))throw new CalculationModuleError('unsupported-model','Unknown water model.',{model:payload.model});
 if(request.moduleId==='water-heos'&&payload.model!==undefined&&payload.model!=='HEOS::Water')throw new CalculationModuleError('unsupported-model','Unknown HEOS pilot model.',{model:payload.model});
 if(request.moduleId==='gas-tables'&&!['mole','mass'].includes(payload.basis??'mole'))throw new CalculationModuleError('invalid-input','Unknown gas composition basis.',{basis:payload.basis});
 return {descriptor,payload,canonicalUnits};
}
function calculationReplyIdentity(request){return {protocolVersion:CALCULATION_PROTOCOL_VERSION,id:request?.id,moduleId:request?.moduleId,engineVersion:request?.engineVersion,implementationRevision:request?.implementationRevision,methodId:request?.methodId};}
function calculationErrorReply(request,error){
 const known=error instanceof CalculationModuleError;
 return {...calculationReplyIdentity(request),status:'error',error:{code:known?error.code:'calculation',message:typeof error?.message==='string'?error.message:'Calculation failed.',details:known?error.details:{}}};
}
function validateCalculationReply(request,reply){
 if(!calculationObject(reply)||Object.entries(calculationReplyIdentity(request)).some(([key,value])=>reply[key]!==value)||!['ok','error','progress'].includes(reply.status))throw new CalculationModuleError('protocol','Invalid calculation response.');
 if(reply.status==='progress'&&(!calculationObject(reply.progress)||typeof reply.progress.stage!=='string'))throw new CalculationModuleError('protocol','Invalid calculation progress.');
 if(reply.status==='error'&&(!calculationObject(reply.error)||typeof reply.error.code!=='string'||typeof reply.error.message!=='string'))throw new CalculationModuleError('protocol','Invalid calculation error response.');
 if(reply.status==='ok'&&!Object.hasOwn(reply,'result'))throw new CalculationModuleError('protocol','Missing calculation result.');
 return reply;
}
function calculationQuantities(result,format){
 const quantities={};
 const collect=(state,prefix)=>{if(!calculationObject(state))return;for(const [key,unit] of Object.entries(calculationOutputUnits)){
  if(!Object.hasOwn(state,key))continue;const value=state[key];
  if(value!==null&&!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite calculation output.',{field:prefix+key});
  quantities[prefix+key]={value,unit,status:value===null?'unavailable':'available'};
 }};
 if(format==='gas-state'){
  collect(result,'');
  for(const [field,basis] of [['composition','mole'],['massComposition','mass']]){
   if(!calculationObject(result[field]))continue;
   for(const [species,value] of Object.entries(result[field])){
    if(!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite composition output.',{field:field+'.'+species});
    quantities[field+'.'+species]={value,unit:'1',basis,status:'available'};
   }
  }
  if(result.reference){
   for(const [key,unit] of [['T0','K'],['p0','MPa']])if(Object.hasOwn(result.reference,key)){
    const value=result.reference[key];if(!Number.isFinite(value))throw new CalculationModuleError('invalid-result','Nonfinite reference output.',{field:'reference.'+key});
    quantities['reference.'+key]={value,unit,status:'available'};
   }
  }
 }
 if(format==='water-state'){
  collect(result.state,'state.');collect(result.saturation,'saturation.');
  collect(result.saturation?.liquid,'saturation.liquid.');collect(result.saturation?.vapor,'saturation.vapor.');
  for(const [index,state] of (result.alternatives||[]).entries())collect(state,'alternatives.'+index+'.');
 }
 return quantities;
}


// Optional package cache is independent of core PWA releases. Completion is
// published only after every byte has been checked; project storage is untouched.
function pythonPackageCacheName(config,baseURL){return 'thermocalc-python:'+new URL(baseURL).pathname+'|'+config.revision;}
function createPythonPackageManager(config,baseURL,{storage=globalThis.caches,fetchResource=globalThis.fetch,locks=globalThis.navigator?.locks}={}){
 const base=new URL(baseURL),name=pythonPackageCacheName(config,base),marker=new URL('assets/python/'+config.revision+'/complete',base).href;
 const status=async()=>{
  if(!storage||!(await storage.keys()).includes(name))return {ready:false,bytes:config.bytes};
  const cache=await storage.open(name),complete=await cache.match(marker);if(!complete||(await complete.text())!==config.revision)return {ready:false,bytes:config.bytes};
  for(const file of config.files)if(!await cache.match(new URL(file.url,base).href))return {ready:false,bytes:config.bytes};
  return {ready:true,bytes:config.bytes};
 };
 let installing=null;
 const install=({signal,onProgress}={})=>{
  if(installing)return installing;
  const prepare=async()=>{
   if((await status()).ready)return status();
   const cache=await storage.open(name);let bytes=0;
   try{
    for(const [index,file] of config.files.entries()){
     signal?.throwIfAborted();const url=new URL(file.url,base).href;
     const response=await fetchResource(url,{cache:'no-store',signal});if(!response.ok)throw Error('Download failed: '+file.url);
     const data=await response.arrayBuffer();
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
     if(data.byteLength!==file.bytes||hash!==file.sha256)throw Error('Package integrity check failed: '+file.url);
     const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
     await cache.put(url,new Response(data,{headers}));bytes+=data.byteLength;
     onProgress?.({done:index+1,total:config.files.length,bytes,totalBytes:config.bytes});
    }
    signal?.throwIfAborted();await cache.put(marker,new Response(config.revision));return {ready:true,bytes:config.bytes};
   }catch(error){await storage.delete(name);throw error;}
  };
  installing=(locks?.request?locks.request(name,{signal},prepare):Promise.reject(Error('This browser does not support coordinated package downloads.'))).finally(()=>{installing=null;});return installing;
 };
 return {status,install,async remove(){if(installing)throw Error('Cancel the package download first.');const remove=()=>storage.delete(name);if(locks?.request)await locks.request(name,remove);else await remove();}};
}


// Canonical SI contract for the deliberately small, checked fluids workflow.
const PIPE_VERIFICATION_UNITS={area:'m2',mu:'Pa s',nu:'m2/s',mass:'kg/s',volume:'m3/s',velocity:'m/s',Re:'1',dynamicPressure:'Pa',factor:'1',fanningFactor:'1',frictionPressure:'Pa',localPressure:'Pa',lossPressure:'Pa',lossHead:'m',requiredHead:'m',pumpHead:'m',hydraulicPower:'W',shaftPower:'W'};
const PIPE_VERIFICATION_INPUT_UNITS={rho:'kg/m3',mu:'Pa s',velocity:'m/s',diameter:'m',length:'m',roughness:'m',localK:'1',efficiency:'1',heightDifference:'m',pressureDifference:'Pa'};
function pipeVerificationPayload(flow,hydraulics,frictionMethod){
 if(!['Clamond','Colebrook'].includes(frictionMethod))throw Error('Unknown fluids pipe friction method.');
 return {rho:flow.rho,mu:flow.mu,velocity:flow.velocity,diameter:flow.diameter,...Object.fromEntries(['length','roughness','localK','efficiency','heightDifference','pressureDifference'].map(key=>[key,hydraulics[key]])),frictionMethod};
}
function comparePipeVerification(flow,hydraulics,result){
 const control={...flow,...hydraulics},absoluteTolerance=1e-10,relativeTolerance=5e-11;
 const rows=Object.entries(PIPE_VERIFICATION_UNITS).map(([key,unit])=>{
  const expected=control[key],actual=result[key];
  if(!((actual===null||Number.isFinite(actual))&&(expected===null||Number.isFinite(expected))))throw Error('Invalid pipe verification quantity: '+key);
  const difference=actual===null||expected===null?null:actual-expected,absoluteDifference=difference===null?null:Math.abs(difference);
  return {key,unit,control:expected,fluids:actual,difference,relativeDifference:difference===null||expected===0?null:difference/Math.abs(expected),passed:actual===null||expected===null?actual===expected:absoluteDifference<=absoluteTolerance+relativeTolerance*Math.max(Math.abs(actual),Math.abs(expected))};
 });
 return {passed:rows.every(row=>row.passed),absoluteTolerance,relativeTolerance,rows};
}



const pythonWorkerBase=new URL('../',self.location.href);
let pythonBackend;
async function initializePythonBackend(request){
 const progress=stage=>self.postMessage({...calculationReplyIdentity(request),status:'progress',progress:{stage}});
 if(!(await createPythonPackageManager(PYTHON_PACKAGE,pythonWorkerBase).status()).ready)throw new CalculationModuleError('module-missing','Prepare the ht / fluids offline package first.');
 progress('runtime');
 const indexURL=new URL(PYTHON_PACKAGE.base+'pyodide/',pythonWorkerBase).href;
 const {loadPyodide}=await import(indexURL+'pyodide.mjs');
 const pyodide=await loadPyodide({indexURL,enableRunUntilComplete:false});
 progress('dependencies');await pyodide.loadPackage(['numpy','scipy']);
 const directory=pyodide.runPython('import sysconfig; sysconfig.get_paths()["purelib"]');
 for(const name of ['fluids','ht']){
  const response=await fetch(new URL(PYTHON_PACKAGE.base+PYTHON_PACKAGE.packages[name].file,pythonWorkerBase));
  if(!response.ok)throw new CalculationModuleError('module-missing','The local library package is missing.');
  pyodide.unpackArchive(new Uint8Array(await response.arrayBuffer()),'zip',{extractDir:directory});
 }
 progress('libraries');await pyodide.runPythonAsync(PYTHON_BRIDGE_SOURCE);
 const versions=JSON.parse(pyodide.runPython('json.dumps({name:importlib.metadata.version(name) for name in ("ht","fluids","numpy","scipy")})'));
 for(const [name,entry] of Object.entries(PYTHON_PACKAGE.packages))if(versions[name]!==entry.version)throw new CalculationModuleError('version-mismatch','Python package version does not match.',{name});
 return {pyodide,execute:pyodide.globals.get('_thermocalc_library_json')};
}
self.onmessage=async({data:request})=>{
 try{
  const {descriptor,payload}=normalizeCalculationRequest(request);
  if(!['ht','fluids'].includes(descriptor.id))throw new CalculationModuleError('unsupported-module','This worker executes ht / fluids.');
  if(!(await createPythonPackageManager(PYTHON_PACKAGE,pythonWorkerBase).status()).ready)throw new CalculationModuleError('module-missing','Prepare the ht / fluids offline package first.');
  pythonBackend??=initializePythonBackend(request).catch(error=>{pythonBackend=null;throw error;});
  const backend=await pythonBackend;
  const response=JSON.parse(backend.execute(JSON.stringify({module:request.moduleId,method:request.methodId,payload})));
  if(!response.ok)throw new CalculationModuleError(response.code,response.message,{engineVersion:descriptor.engineVersion,implementationRevision:request.implementationRevision,...(response.description?{description:response.description}:{})});
  const outputs=response.description?.documentedUnits?.Returns??[];
  const pipe=request.methodId==='pipe-hydraulics';
  const quantities=pipe?Object.fromEntries(Object.entries(PIPE_VERIFICATION_UNITS).map(([key,unit])=>[key,{value:response.result[key],unit,status:response.result[key]===null?'unavailable':'available'}])):typeof response.result==='number'?{result:{value:response.result,unit:outputs.length===1?outputs[0].unit:null,status:'available',unitSource:'upstream-documentation'}}:{};
  self.postMessage({...calculationReplyIdentity(request),status:'ok',result:response.result,model:request.moduleId+' '+descriptor.engineVersion,quantities,
   units:pipe?{convention:'Canonical SI; explicit pipe workflow contract, no implicit unit conversion.',inputs:PIPE_VERIFICATION_INPUT_UNITS,outputs:PIPE_VERIFICATION_UNITS}:{convention:'Upstream documented units (generally SI); no automatic conversion.',inputs:response.description?.documentedUnits?.Parameters??[],outputs},
   warnings:[{code:'integration-only',message:'Library connected; comprehensive independent numerical acceptance is pending.'},...(response.description?.knownIssues??[])],
   validity:descriptor.validity,...(response.description?{description:response.description}:{})});
 }catch(error){self.postMessage(calculationErrorReply(request,error));}
};

