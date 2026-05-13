import { describe, test, expectTypeOf } from "vitest";
import { AccessConfig, AccessDefinition, AccessPayload, AccessPermissions, AccessValidatorContext, AccessValidatorError, defineUpdateAccessValidator, UpdateAccessValidator } from "#src/access.js";

type UserAccessPayload = {
    user: {
        id: string
    }
};

describe('Access - Update validator', () => {
    test("Validator schema type - inline", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const accessDef: AccessDefinition<TestDoc> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc, update) => {
                        expectTypeOf(context).toEqualTypeOf<AccessValidatorContext<AccessPayload>>();
                        expectTypeOf(doc).toExtend<TestDoc>();
                    }
                }
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).toExtend<UpdateAccessValidator<TestDoc>>();
    });

    test("Validator schema type - variable", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const updateValidator = defineUpdateAccessValidator<TestDoc>()([], async (context, doc) => {});

        expectTypeOf(updateValidator.validator).toExtend<UpdateAccessValidator<TestDoc>>();

        const accessDef: AccessDefinition<TestDoc> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: updateValidator
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).toExtend<UpdateAccessValidator<TestDoc>>();
    });

    test("Validator default access payload type", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const updateValidator = defineUpdateAccessValidator<TestDoc>()([], async (context, doc) => {});

        expectTypeOf(updateValidator.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<AccessPayload>>();

        const accessDef: AccessDefinition<TestDoc> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: updateValidator
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<AccessPayload>>();
    });

    test("Validator custom access payload type - def only", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const updateValidator = defineUpdateAccessValidator<TestDoc>()([], async (context, doc) => {});

        expectTypeOf(updateValidator.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<AccessPayload>>();

        const accessDef: AccessDefinition<TestDoc, UserAccessPayload> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: updateValidator
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
    });

    test("Validator custom access payload type - def & variable", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const updateValidator = defineUpdateAccessValidator<TestDoc, UserAccessPayload>()([], async (context, doc) => {});

        expectTypeOf(updateValidator.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();

        const accessDef: AccessDefinition<TestDoc, UserAccessPayload> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: updateValidator
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
    });

    test("Validator custom access payload type - inline", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const accessDef: AccessDefinition<TestDoc, UserAccessPayload> = {
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        expectTypeOf(context).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
                    }
                }
            }
        };

        expectTypeOf(accessDef.validators!.update!.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
    });

    test("Validator custom access payload type - config", async () => {
        type TestDoc = { _id: string, name: string, value: number };

        const accessConfig: AccessConfig<TestDoc, UserAccessPayload> = [{
            role: "test",
            document: AccessPermissions.ReadWrite,
            validators: {
                update: {
                    validator: async (context, doc) => {
                        expectTypeOf(context).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
                    }
                }
            }
        }];

        expectTypeOf(accessConfig[0].validators!.update!.validator).parameter(0).toEqualTypeOf<AccessValidatorContext<UserAccessPayload>>();
    });
});