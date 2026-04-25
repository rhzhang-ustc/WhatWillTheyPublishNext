(function (window, document) {
	
	function titleCase(str) {
		return str.split(' ').map((word,i) => {
			return (word.length > 3 || i==0) ? word.charAt(0).toUpperCase() + word.slice(1) : word;
		}).join(' ');
	}
	function bigWords(str) {
		var res = [];
		var words = str.split(' ');
		var exclude = ['unreasonable','effectiveness','novel','with','over','using','need','approach','towards'];
		for(var i=0; i<words.length; i++) {
			if(words[i].length > 3 && !exclude.includes(words[i]))
				res.push(words[i]);
		}
		return res;
	}
	function acronym(str,min=3,max=6) {
		var words = bigWords(str);
		if(words.length < max) {
			max = words.length;
		}
		var num = min + Math.floor(Math.random()*(max-min+1));
		var acro = '';
		var start = Math.floor(Math.random()*(words.length-num));
		for(var i=start;i<start+num;i++)
			acro = acro + words[i].charAt(0);
		return acro.toUpperCase();
	}

	function generate_icra_paper_title() { 
		var learningmethod = ['transformer','diffusion policy','foundation model','generative adversarial network','monte-carlo tree search','imitation learning','deep reinforcement learning','transfer learning','Gaussian splatting','neural radiance field','LLM','VLA model'];
		var learningmethods = ['transformers','diffusion policies','foundation models','generative adversarial networks','monte-carlo tree search','imitation learning','deep reinforcement learning','transfer learning','Gaussian splatting','neural radiance fields','LLMs','VLA models'];
		var learningmethod_category = [false,false,false,false,true,true,true,true,true,false,false,false];
		var learningvariant = ['open-world','few-shot','continual','probabilistic','adversarial','cross-embodiment','contrastive','certifiable'];
		var task = ['mapping','localization','sensor fusion','3D mapping','object recognition','3D segmentation','BEV mapping','multi-robot coordination','supervisory control','dynamic scenes','tracking','prediction','traversability estimation','manipulation','cooperative manipulation','in-hand manipulation','bimanual manipulation','task and motion planning','control','human-robot coordination'];
		var taskpostvariant = {'mapping':['with event cameras','using thermal imaging','using sonar','using lidar','under pose uncertainty','in open worlds','in indoor environments','in the wild'],
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
		var taskprevariant = {'mapping':['event camera','thermal ','sonar-based','lidar-based','open-world','indoor'],
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
		var application = ['autonomous vehicles','mobile robots','aerial vehicles','mobile manipulators','household robots','humanoids','industrial robots','delivery vehicles','underwater robots','underwater manipulators','unmanned surface vehicles','anthropomorphic hands','soft robots','continuum robots','medical robots','surgical robots','a novel underwater robot','a hybrid wheel-legged robot','a novel aerial vehicle','a three-legged humanoid','a novel anthropomorphic hand','a novel soft robot'];
		var patterns = ['LEARNINGVARIANT LEARNINGMETHODS for TASKPREVARIANT TASK in APPLICATION TASKPOSTVARIANT',
			'a novel LEARNINGMETHOD_NOUN for TASKPREVARIANT TASK in APPLICATION TASKPOSTVARIANT',
			'towards a LEARNINGVARIANT LEARNINGMETHOD_NOUN for TASKPREVARIANT TASK in APPLICATION TASKPOSTVARIANT',
			'LEARNINGMETHOD_IS all you need: LEARNINGVARIANT TASKPREVARIANT TASK for APPLICATION TASKPOSTVARIANT',
			'TASKPREVARIANT TASK in APPLICATION TASKPOSTVARIANT with LEARNINGVARIANT LEARNINGMETHODS',
			'the unreasonable effectiveness of LEARNINGMETHODS for TASKPREVARIANT TASK in APPLICATION TASKPOSTVARIANT'
		];
		var chosen_pattern = Math.floor(Math.random()*patterns.length);
		pattern = patterns[chosen_pattern];
		var chosen_task = Math.floor(Math.random()*task.length);
		task = task[chosen_task];
		var chosen_learningmethod = Math.floor(Math.random()*learningmethod.length);
		learningmethod = learningmethod[chosen_learningmethod];
		learningmethods = learningmethods[chosen_learningmethod];
		var chosen_learningvariant = Math.floor(Math.random()*learningvariant.length);
		learningvariant = learningvariant[chosen_learningvariant];
		var chosen_application = Math.floor(Math.random()*application.length);
		application = application[chosen_application];
		var use_prevariant = (Math.random() < 0.3) && task in taskprevariant;
		var use_postvariant = (Math.random() < 0.3) && task in taskpostvariant && !use_prevariant;
		var chosen_prevariant = use_prevariant ? Math.floor(Math.random()*taskprevariant[task].length) : -1;
		taskprevariant = chosen_prevariant >= 0 ? taskprevariant[task][chosen_prevariant] : '';
		var chosen_postvariant = use_postvariant ? Math.floor(Math.random()*taskpostvariant[task].length) : -1;
		taskpostvariant = chosen_postvariant  >= 0 ? taskpostvariant[task][chosen_postvariant] : '';
		var use_acronym = Math.random() < 0.6;
		var learningmethod_is = learningmethod_category[chosen_learningmethod] ? learningmethod + ' is' : learningmethods + ' are';
		var learningmethod_noun = learningmethod_category[chosen_learningmethod] ? learningmethod + ' approach' : learningmethod;
		var title = pattern.replace('LEARNINGMETHOD_NOUN',learningmethod_noun).replace('LEARNINGMETHOD_IS',learningmethod_is).replace('LEARNINGVARIANT',learningvariant).replace('LEARNINGMETHODS',learningmethods).replace('LEARNINGMETHOD',learningmethod).replace('TASKPREVARIANT',taskprevariant).replace('TASKPOSTVARIANT',taskpostvariant).replace('APPLICATION',application).replace('TASK',task);
		title = title.replace('  ',' ');
		if(use_acronym)
			title = acronym(title) + ': ' + title;
		return titleCase(title);
	}

    var content  = document.getElementById('icra_title');
	content.innerHTML = generate_icra_paper_title();

}(this, this.document));