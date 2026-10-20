"""Fixed SI workflow; public fluids functions, explicit application domain policy."""
import math
import importlib.metadata
import fluids

def _thermocalc_pipe(payload):
    defaults = {'length': 0, 'roughness': 0, 'localK': 0, 'efficiency': .75,
                'heightDifference': 0, 'pressureDifference': 0}
    required = ('rho', 'mu', 'velocity', 'diameter')
    allowed = set(required) | set(defaults) | {'frictionMethod'}
    if set(payload) - allowed:
        raise ValueError('Unknown pipe input field.')
    p = {**defaults, **payload}
    for key in (*required, *defaults):
        value = p.get(key)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError('Finite numeric SI input required: ' + key)
    if any(p[k] <= 0 for k in ('rho', 'mu', 'diameter')):
        raise ValueError('Density, viscosity and inner diameter must be positive.')
    if any(p[k] < 0 for k in ('velocity', 'length', 'roughness', 'localK')):
        raise ValueError('Velocity, length, roughness and local K must be nonnegative.')
    if not 0 < p['efficiency'] <= 1 or p['roughness']/p['diameter'] > .05:
        raise ValueError('Require 0 < efficiency <= 1 and 0 <= roughness/D <= 0.05.')
    requested = p.get('frictionMethod', 'Clamond')
    if requested not in ('Clamond', 'Colebrook'):
        raise ValueError('Friction method must be Clamond or Colebrook.')
    rho, mu, V, D = (p[k] for k in required)
    area, nu = math.pi*D*D/4, mu/rho
    if area <= 0 or nu <= 0:
        raise ValueError('Derived area or viscosity underflows.')
    volume = area*V
    mass = rho*volume
    Re = fluids.Reynolds(V=V, D=D, rho=rho, mu=mu)
    if not math.isfinite(Re) or Re < 0 or V > 0 and Re == 0:
        raise ValueError('Derived Reynolds number is invalid.')
    if V == 0:
        factor, method = None, 'zero'
    elif Re < 2300:
        # fluids.friction_factor switches at 2040; the application's explicit
        # 2300/4000 policy must not be replaced by that upstream default.
        factor, method = fluids.friction_laminar(Re), 'laminar'
    elif Re < 4000:
        factor, method = None, 'transition'
    else:
        factor = fluids.friction_factor(Re=Re, eD=p['roughness']/D, Method=requested, Darcy=True)
        method = requested.lower()
    dynamic = fluids.dP_from_K(K=1, rho=rho, V=V)
    local = fluids.dP_from_K(K=p['localK'], rho=rho, V=V)
    friction = 0 if V == 0 or p['length'] == 0 else None if factor is None else fluids.dP_from_K(K=factor*p['length']/D, rho=rho, V=V)
    loss = None if friction is None else friction+local
    g = 9.80665
    head = None if loss is None else loss/(rho*g)
    required_head = None if head is None else head+p['heightDifference']+p['pressureDifference']/(rho*g)
    pump = None if required_head is None else max(0, required_head)
    hydraulic = None if pump is None else rho*g*volume*pump
    result = {**p, 'area': area, 'mu': mu, 'nu': nu, 'mass': mass, 'volume': volume,
              'velocity': V, 'Re': Re, 'dynamicPressure': dynamic, 'factor': factor,
              'fanningFactor': None if factor is None else factor/4,
              'frictionPressure': friction, 'localPressure': local, 'lossPressure': loss,
              'lossHead': head, 'requiredHead': required_head, 'pumpHead': pump,
              'hydraulicPower': hydraulic, 'shaftPower': None if hydraulic is None else hydraulic/p['efficiency'],
              'frictionMethod': requested, 'method': method, 'backend': 'fluids', 'engineVersion': importlib.metadata.version('fluids'),
              'policy': 'incompressible-round-pipe-2300-4000-v1'}
    if any(isinstance(v, (int, float)) and not math.isfinite(v) for v in result.values()):
        raise ValueError('Pipe calculation overflow.')
    return result
