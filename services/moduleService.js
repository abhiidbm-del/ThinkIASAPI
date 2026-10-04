// services/moduleService.js
const Module = require('../models/Module');

class ModuleService {
  static async createModule(moduleData) {
    return await Module.create(moduleData);
  }

  static async getAllModules() {
    return await Module.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 });
  }

  static async getModuleById(moduleId) {
    return await Module.findById(moduleId);
  }

  static async updateModule(moduleId, updateData) {
    return await Module.findByIdAndUpdate(
      moduleId,
      updateData,
      { new: true, runValidators: true }
    );
  }

  static async deleteModule(moduleId) {
    return await Module.findByIdAndDelete(moduleId);
  }

  static async toggleModuleStatus(moduleId) {
    const module = await Module.findById(moduleId);
    if (!module) throw new Error('Module not found');
    
    module.isActive = !module.isActive;
    await module.save();
    return module;
  }

  static async getModulesByCreator(creatorId) {
    return await Module.find({ createdBy: creatorId })
      .sort({ createdAt: -1 });
  }

  static async updateModuleOrder(moduleId, newOrder) {
    return await Module.findByIdAndUpdate(
      moduleId,
      { order: newOrder },
      { new: true }
    );
  }
}

module.exports = ModuleService;