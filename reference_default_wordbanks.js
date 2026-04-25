// Reference: original word banks from Kris Hauser's icrapapers.js,
// previously embedded as defaults in index.html.
// Kept here for reference only — the live app now relies entirely
// on author-conditioned word banks produced by the GPT extractor.

const learningmethod = ['transformer','diffusion policy','foundation model','generative adversarial network','monte-carlo tree search','imitation learning','deep reinforcement learning','transfer learning','Gaussian splatting','neural radiance field','LLM','VLA model'];
const learningmethods = ['transformers','diffusion policies','foundation models','generative adversarial networks','monte-carlo tree search','imitation learning','deep reinforcement learning','transfer learning','Gaussian splatting','neural radiance fields','LLMs','VLA models'];
const learningmethod_category = [false,false,false,false,true,true,true,true,true,false,false,false];
const learningvariant = ['open-world','few-shot','continual','probabilistic','adversarial','cross-embodiment','contrastive','certifiable'];

const tasks = ['mapping','localization','sensor fusion','3D mapping','object recognition','3D segmentation','BEV mapping','multi-robot coordination','supervisory control','dynamic scenes','tracking','prediction','traversability estimation','manipulation','cooperative manipulation','in-hand manipulation','bimanual manipulation','task and motion planning','control','human-robot coordination'];

const taskpostvariant = {
    'mapping':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in the wild'],
    'localization':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild'],
    'sensor fusion':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild'],
    '3D mapping':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild','in clutter'],
    'object recognition':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild','in clutter'],
    '3D segmentation':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild','in clutter'],
    'BEV mapping':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild'],
    'multi-robot coordination':['with communication constraints','in heterogeneous teams'],
    'supervisory control':['under time delay','in VR'],
    'dynamic scenes':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in challenging weather','in the wild','in clutter'],
    'tracking':['with multiple targets','and prediction','over long time horizons'],
    'prediction':['over long time horizons','with heterogeneous intent'],
    'manipulation':['of unknown objects','of household objects','of small parts','of cables','of deformable objects','of a suspended load'],
    'in-hand manipulation':['with contact sensors','with tactile skin','with tactile feedback'],
    'bimanual manipulation':['with contact sensors','with tactile skin','with tactile feedback'],
};

const taskprevariant = {
    'mapping':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    'localization':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    'sensor fusion':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    '3D mapping':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    'BEV mapping':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    'multi-robot coordination':['communication-constrained','heterogeneous'],
    'object recognition':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    '3D segmentation':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
    'supervisory control':['immersive','VR-based','full-body'],
    'tracking':['multi-target','long-horizon','human','pedestrian','vehicle'],
    'prediction':['long-horizon','human motion','pedestrian','vehicle'],
    'control':['agile','robust','adaptive','force','hybrid'],
    'manipulation':['cable','cloth','deformable object'],
    'in-hand manipulation':['sensorless'],
};

const applications = ['autonomous vehicles','mobile robots','aerial vehicles','mobile manipulators','household robots','humanoids','industrial robots','delivery vehicles','underwater robots','underwater manipulators','unmanned surface vehicles','anthropomorphic hands','soft robots','continuum robots','medical robots','surgical robots','a novel underwater robot','a hybrid wheel-legged robot','a novel aerial vehicle','a three-legged humanoid','a novel anthropomorphic hand','a novel soft robot'];
