// A single index, with separate retention quotas determined from project metadata.
export class HomeRecentProjects {
    constructor ({readPaths, writePaths, readInfo, pathKey, limit = 16}) {
        Object.assign(this, {readPaths, writePaths, readInfo, pathKey, limit});
        this.queue = Promise.resolve();
    }

    transaction (action) {
        const result = this.queue.then(action);
        this.queue = result.catch(() => {});
        return result;
    }

    async collect (paths) {
        const projects = (await Promise.all(paths.map(this.readInfo))).filter(Boolean);
        const counts = new Map();
        const seen = new Set();
        return projects.filter(project => {
            const key = this.pathKey(project.path);
            const group = project.hardwareId || 'unknown';
            if (seen.has(key) || (counts.get(group) || 0) >= this.limit) return false;
            seen.add(key);
            counts.set(group, (counts.get(group) || 0) + 1);
            return true;
        });
    }

    list () {
        return this.transaction(async () => {
            const paths = await this.readPaths();
            const projects = await this.collect(paths);
            const retained = projects.map(project => project.path);
            if (JSON.stringify(paths) !== JSON.stringify(retained)) await this.writePaths(retained);
            return projects;
        });
    }

    remember (projectPath) {
        return this.transaction(async () => {
            const project = await this.readInfo(projectPath);
            if (!project) return null;
            const key = this.pathKey(project.path);
            const paths = [project.path, ...(await this.readPaths()).filter(value => this.pathKey(value) !== key)];
            const retained = await this.collect(paths);
            await this.writePaths(retained.map(item => item.path));
            return project;
        });
    }

    remove (projectPath) {
        return this.transaction(async () => {
            const key = this.pathKey(projectPath);
            await this.writePaths((await this.readPaths()).filter(value => this.pathKey(value) !== key));
        });
    }
}
